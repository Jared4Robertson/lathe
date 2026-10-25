import { forwardRef, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from '../components/icons';
import { navigate } from '../router';
import { kindLabel, type SpecIndex } from '../specs/data';
import { addressOf } from '../views/address';
import { checkPagePath, kindPagePath, useFormat } from '../format/reference';
import { useShortcutHint } from './commands';

// Quick find (quick open): a search at the top of the nav that jumps to a record, domain or
// product of the current space by ID or title. It reads the space's own index, so nothing of
// another product is found: switching product is the rail's job. The format's kinds and checks are
// found too, as "Kind: Use case" and "Check: too-many-children", leading to their pages in the
// format reference. Arrow keys move through the results, Enter opens one, Escape clears the
// search.

export interface FindItem {
  key: string;
  id: string;
  title: string;
  kind: string;
  to: string;
}

export function findItems(index: SpecIndex | null, checks: readonly string[] = []): FindItem[] {
  const items: FindItem[] = [];
  if (index) {
    for (const r of index.workspace.records) {
      items.push({ key: r.id, id: r.id, title: r.title, kind: kindLabel(index, r.kind), to: addressOf(r.id) });
    }
    for (const k of index.workspace.kinds) {
      items.push({ key: `kind:${k.kind}`, id: k.kind, title: `Kind: ${k.label}`, kind: 'Record format', to: kindPagePath(k.kind) });
    }
    for (const c of new Set([...checks, ...index.workspace.problems.map((p) => p.check)])) {
      items.push({ key: `check:${c}`, id: c, title: `Check: ${c}`, kind: 'Record format', to: checkPagePath(c) });
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

export interface QuickFindProps {
  /** The current space's index. */
  index: SpecIndex | null;
  onGo?: () => void;
  /** In a sheet (the phone): the results are a list under the box rather than a dropdown, and more of them show. */
  inline?: boolean;
  /** What sits beside the box in a sheet, such as its Close button. */
  trailing?: ReactNode;
}

export const QuickFind = forwardRef<HTMLInputElement, QuickFindProps>(
  function QuickFind({ index, onGo, inline = false, trailing }, ref) {
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const [open, setOpen] = useState(false);
    const listId = useId();
    const shortcut = useShortcutHint('quickOpen');
    // The format's checks are fetched once something is typed.
    const { reference } = useFormat(index, query.trim() !== '');
    const checks = useMemo(() => reference?.checks.map((c) => c.check) ?? [], [reference]);
    const all = useMemo(() => findItems(index, checks), [index, checks]);
    const results = useMemo(() => rankItems(all, query, inline ? 20 : 8), [all, query, inline]);
    const at = Math.min(active, Math.max(0, results.length - 1));
    const go = (item: FindItem) => {
      setQuery('');
      setOpen(false);
      navigate(item.to);
      onGo?.();
    };
    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setOpen(true); setActive((at + 1) % results.length); }
      else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive((at - 1 + results.length) % results.length); }
      else if (e.key === 'Enter' && results[at]) { e.preventDefault(); go(results[at]); }
      else if (e.key === 'Escape') {
        if (query) { e.preventDefault(); e.stopPropagation(); setQuery(''); setOpen(false); }
        else (e.target as HTMLInputElement).blur();
      }
    };
    const expanded = (open || inline) && query.trim() !== '';
    const list = expanded && (
          <ul className={`quick-find-results${inline ? ' is-inline' : ''}`} id={listId} role="listbox" aria-label="Quick find results">
            {results.map((r, i) => (
              <li
                key={r.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === at}
                className={i === at ? 'active' : undefined}
                onMouseDown={(e) => { e.preventDefault(); go(r); }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="qf-title">{r.title}</span>
                <span className="qf-meta"><code>{r.id}</code> · {r.kind}</span>
              </li>
            ))}
            {results.length === 0 && <li className="hint" role="presentation">Nothing matches.</li>}
          </ul>
    );
    const box = (
      <div className="quick-find">
        <Icon name="search" size={16} />
        <input
          ref={ref}
          type="text"
          role="combobox"
          aria-label="Quick find"
          aria-keyshortcuts={shortcut.aria}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && results[at] ? `${listId}-${at}` : undefined}
          placeholder={`Go to…${shortcut.text ? ` ${shortcut.text}` : ''}`}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          enterKeyHint="go"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {!inline && list}
      </div>
    );
    if (!inline) return box;
    return (
      <div className="quick-find-inline">
        <div className="quick-find-row">{box}{trailing}</div>
        {list}
      </div>
    );
  },
);
