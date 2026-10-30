import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { isGroup } from '../graph/model';
import { navigate } from '../router';
import { openInNewPlace } from '../views/usePlace';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { KindBadge } from '../specs/parts';
import { checkPagePath, kindPagePath, useFormat } from '../format/reference';
import { addressOf } from '../views/address';
import { focusTrail } from '../views/HeaderStrip';
import { setPreview } from '../views/preview';
import { collapseCrumbs } from './Breadcrumb';
import { Dialog, Keys, useCommandList } from './commands';
import { ariaKeyShortcuts, type Command } from './keymap';
import { useNarrow } from './useNarrow';

// Quick open (LA-V64): one centered overlay for quick find and the command palette, as VS Code's.
// Cmd/Ctrl+P opens it on records: typing filters the current space's records, domains and
// products by ID or title (and the record format's kinds and checks), best matches first; Up and
// Down move through them, Enter goes there (Cmd/Ctrl+Enter or a Cmd/Ctrl+click opens it in a new place: a tab,
// or a browser tab on the web), Escape closes. A query that starts with ">" lists the
// commands that apply instead, each with its keys (Cmd/Ctrl+Shift+P opens it so); deleting the
// ">" goes back to records. While a record is highlighted the stage previews it (views/preview.ts):
// the camera glides there and the wiki card shows it; Enter commits, Escape puts the camera, the
// card and keyboard focus back where they were. It reads only the space's own index, so nothing of
// another product is found: switching product is the rail's job. On a phone it is a full-width
// sheet at the top.

export interface FindItem {
  key: string;
  id: string;
  title: string;
  /** The record's kind, for its chip; absent for a page of the record format. */
  kind?: string;
  to: string;
}

export function findItems(index: RecordIndex | null, checks: readonly string[] = []): FindItem[] {
  const items: FindItem[] = [];
  if (index) {
    for (const r of index.byId.values()) {
      items.push({ key: r.id, id: r.id, title: r.title, kind: r.kind, to: addressOf(r.id) });
    }
    for (const k of index.meta.kindList) {
      items.push({ key: `kind:${k.kind}`, id: k.kind, title: `Kind: ${k.label}`, to: kindPagePath(k.kind) });
    }
    for (const c of new Set([...checks, ...[...index.problemsFor.values()].flat().map((p) => p.check)])) {
      items.push({ key: `check:${c}`, id: c, title: `Check: ${c}`, to: checkPagePath(c) });
    }
  }
  return items;
}

/** The best matches for a query: exact ID, then ID prefix, then title words, then anywhere. */
export function rankItems(items: readonly FindItem[], query: string, limit = 8): FindItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const score = (item: FindItem) => {
    const id = item.id.toLowerCase();
    const title = item.title.toLowerCase();
    if (id === q) return 0;
    if (id.startsWith(q)) return 1;
    if (title.startsWith(q)) return 2;
    if (title.split(/\s+/).some((w) => w.startsWith(q))) return 3;
    if (id.includes(q) || title.includes(q)) return 4;
    return -1;
  };
  return items
    .map((item) => ({ item, s: score(item) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.item.id.localeCompare(b.item.id, 'en', { numeric: true }))
    .slice(0, limit)
    .map((x) => x.item);
}

/** The prefix that turns quick find into the command palette. */
export const COMMANDS_PREFIX = '>';
/** How many records quick find lists at most. */
const RECORDS_SHOWN = 20;
/**
 * How long the highlight rests before the stage previews it, in ms: typing and arrowing through
 * the list glide the camera to the result they settle on, never to each one passed.
 */
const PREVIEW_REST_MS = 150;

/** The places above a record as one short line, in the one breadcrumb's collapsed form: "Lathe › … › Reading". */
export function trailText(index: RecordIndex, id: string): string {
  const { first, hidden, last } = collapseCrumbs(focusTrail(index, id));
  return [...first.map((c) => c.label), ...(hidden.length ? ['…'] : []), ...last.map((c) => c.label)].join(' › ');
}

/** The commands quick find lists for a query (after the ">"): those that apply, by title or ID. */
export function commandItems(commands: readonly Command[], available: (id: string) => boolean, titleOf: (c: Command) => string, query: string): Command[] {
  const q = query.trim().toLowerCase();
  return commands.filter((c) => !c.local && !c.browser && c.id !== 'quickOpen' && c.id !== 'commandPalette' && available(c.id)
    && (!q || titleOf(c).toLowerCase().includes(q) || c.id.toLowerCase().includes(q)));
}

export interface QuickOpenProps {
  /** The current space's index. */
  index: RecordIndex | null;
  /** What the box holds as it opens, or as its shortcut is pressed again: "" for records, ">" for commands. */
  seed: { query: string; n: number };
  onClose: () => void;
}

export function QuickOpen({ index, seed, onClose }: QuickOpenProps) {
  const [query, setQuery] = useState(seed.query);
  const [active, setActive] = useState(0);
  // Pressing its shortcut again while it is open starts afresh in that mode.
  const seeded = useRef(seed.n);
  useEffect(() => {
    if (seeded.current === seed.n) return;
    seeded.current = seed.n;
    setQuery(seed.query);
    setActive(0);
  }, [seed]);
  const narrow = useNarrow();
  const listId = useId();
  const list = useRef<HTMLUListElement>(null);
  const { commands, mac, available, titleOf, run } = useCommandList();
  const reference = useFormat(index);
  const checks = useMemo(() => reference?.checks.map((c) => c.check) ?? [], [reference]);
  const all = useMemo(() => findItems(index, checks), [index, checks]);

  const inCommands = query.startsWith(COMMANDS_PREFIX);
  const records = useMemo(() => (inCommands ? [] : rankItems(all, query, RECORDS_SHOWN)), [all, query, inCommands]);
  const shownCommands = inCommands ? commandItems(commands, available, titleOf, query.slice(COMMANDS_PREFIX.length)) : [];
  const count = inCommands ? shownCommands.length : records.length;
  const at = Math.min(active, Math.max(0, count - 1));
  const optionId = (i: number) => `${listId}-${i}`;

  // The highlighted record previews on the stage once the highlight rests; a command, a format page or none ends the preview.
  const highlighted = !inCommands ? records[at] : undefined;
  const previewId = highlighted && index && (index.byId.has(highlighted.id) || isGroup(index, highlighted.id)) ? highlighted.id : null;
  useEffect(() => {
    if (previewId === null) { setPreview(null); return; }
    const timer = setTimeout(() => setPreview(previewId), PREVIEW_REST_MS);
    return () => clearTimeout(timer);
  }, [previewId]);
  // Closed any way, the preview ends: committed, the address has moved there already.
  useEffect(() => () => setPreview(null), []);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[id="${optionId(at)}"]`)?.scrollIntoView?.({ block: 'nearest' });
  });

  /** Goes to a record in the place shown, or, with Cmd or Ctrl held, opens it in a new place (a new tab, or a browser tab on the web). */
  const goTo = (item: FindItem, inNew = false) => {
    if (inNew) openInNewPlace(item.to); else navigate(item.to);
    onClose();
  };
  const runCommand = (id: string) => {
    onClose();
    setTimeout(() => run(id), 0);
  };
  const choose = (i: number, inNew = false) => {
    if (inCommands) { if (shownCommands[i]) runCommand(shownCommands[i].id); }
    else if (records[i]) goTo(records[i], inNew);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && count) { e.preventDefault(); setActive((at + 1) % count); }
    else if (e.key === 'ArrowUp' && count) { e.preventDefault(); setActive((at - 1 + count) % count); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(at, e.metaKey || e.ctrlKey); }
  };

  const label = inCommands ? 'Command palette' : 'Quick find';
  const empty = inCommands ? 'No command matches.' : query.trim() ? 'Nothing matches.' : 'Type an ID or a title, or > for a command.';
  return (
    <Dialog label={label} onClose={onClose} className="palette quick-open" backdropClassName="quick-open-backdrop">
      <div className="quick-open-row">
        <div className="quick-open-box">
          <Icon name={inCommands ? 'chevron-right' : 'search'} size={16} />
          <input
            type="text"
            role="combobox"
            aria-label={inCommands ? 'Type a command' : 'Quick find'}
            aria-autocomplete="list"
            aria-expanded={count > 0}
            aria-controls={listId}
            aria-activedescendant={count > 0 ? optionId(at) : undefined}
            placeholder={inCommands ? 'Type a command' : 'Go to a record, or type > for a command'}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            enterKeyHint="go"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        {narrow && <Button className="sheet-close" onClick={onClose}>Close</Button>}
      </div>
      <ul ref={list} id={listId} role="listbox" aria-label={inCommands ? 'Commands' : 'Quick find results'} className="palette-list">
        {inCommands
          ? shownCommands.map((c, i) => (
            <li
              key={c.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === at}
              aria-keyshortcuts={ariaKeyShortcuts(c.keys, mac) || undefined}
              className={i === at ? 'active' : undefined}
              onMouseDown={(e) => { e.preventDefault(); choose(i); }}
            >
              <span className="palette-title">{titleOf(c)}</span>
              {c.keys[0] && <Keys binding={c.keys[0]} mac={mac} className="kbd-hint" />}
            </li>
          ))
          : index && records.map((r, i) => {
            const trail = r.kind ? trailText(index, r.id) : '';
            return (
              <li
                key={r.key}
                id={optionId(i)}
                role="option"
                aria-selected={i === at}
                className={`quick-open-record${i === at ? ' active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); choose(i, e.metaKey || e.ctrlKey); }}
              >
                <span className="quick-open-line">
                  {r.kind ? <KindBadge index={index} kind={r.kind} /> : <span className="kind-badge stage-none">Record format</span>}
                  <code className="quick-open-id">{r.id}</code>
                  <span className="palette-title">{r.title}</span>
                </span>
                {trail && <span className="quick-open-trail">{trail}</span>}
              </li>
            );
          })}
        {count === 0 && <li className="hint" role="presentation">{empty}</li>}
      </ul>
    </Dialog>
  );
}
