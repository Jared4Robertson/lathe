import { forwardRef, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { Icon } from '../components/icons';
import { navigate } from '../router';
import { kindLabel, type SpecIndex } from '../specs/data';
import type { DiagramSummary } from '../types';
import { addressOf } from '../views/address';
import { useShortcutHint } from './commands';
import type { Space } from './spaces';

// Quick find (quick open): a search at the top of the nav that jumps to any record, domain,
// product or diagram by ID or title. The current space's matches come first, then everything
// else under a divider. Arrow keys move through the results, Enter opens one, Escape clears the
// search.

export interface FindItem {
  key: string;
  id: string;
  title: string;
  kind: string;
  to: string;
  /** The product the item belongs to, or null (a diagram). */
  product: string | null;
}

export function findItems(index: SpecIndex | null, diagrams: readonly DiagramSummary[]): FindItem[] {
  const items: FindItem[] = diagrams.map((d) => ({ key: `diagram:${d.slug}`, id: d.slug, title: d.title, kind: 'Diagram', to: `/diagrams/${d.slug}`, product: null }));
  if (index) {
    for (const r of index.workspace.records) {
      items.push({ key: r.id, id: r.id, title: r.title, kind: kindLabel(index, r.kind), to: addressOf(index, r.id), product: r.product });
    }
  }
  return items;
}

export interface ScopedResults {
  /** The best matches in the current space. */
  here: FindItem[];
  /** The best matches everywhere else (other products and diagrams). */
  elsewhere: FindItem[];
}

/** The matches for a query split by space: the current space's first, then the rest. */
export function rankScoped(items: readonly FindItem[], query: string, space: string | null, limit = 8): ScopedResults {
  if (!space) return { here: [], elsewhere: rankItems(items, query, limit) };
  return {
    here: rankItems(items.filter((i) => i.product === space), query, limit),
    elsewhere: rankItems(items.filter((i) => i.product !== space), query, limit),
  };
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

export const QuickFind = forwardRef<HTMLInputElement, { index: SpecIndex | null; diagrams: readonly DiagramSummary[]; space?: Space | null; onGo?: () => void }>(
  function QuickFind({ index, diagrams, space = null, onGo }, ref) {
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const [open, setOpen] = useState(false);
    const listId = useId();
    const shortcut = useShortcutHint('quickOpen');
    const all = useMemo(() => findItems(index, diagrams), [index, diagrams]);
    const scoped = useMemo(() => rankScoped(all, query, space?.id ?? null), [all, query, space]);
    const results = useMemo(() => [...scoped.here, ...scoped.elsewhere], [scoped]);
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
    const expanded = open && query.trim() !== '';
    return (
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
        />
        {expanded && (
          <ul className="quick-find-results" id={listId} role="listbox" aria-label="Quick find results">
            {[
              { name: space ? `In ${space.title}` : '', items: scoped.here, offset: 0 },
              { name: space ? 'Everything else' : '', items: scoped.elsewhere, offset: scoped.here.length },
            ].filter((g) => g.items.length > 0).map((g) => {
              const options = g.items.map((r, j) => {
                const i = g.offset + j;
                return (
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
                );
              });
              if (!g.name) return options;
              return (
                <li key={g.name} role="presentation" className={`qf-group${g.offset > 0 ? ' is-divided' : ''}`}>
                  <span className="qf-group-name" aria-hidden="true">{g.name}</span>
                  <ul role="group" aria-label={g.name}>{options}</ul>
                </li>
              );
            })}
            {results.length === 0 && <li className="hint" role="presentation">Nothing matches.</li>}
          </ul>
        )}
      </div>
    );
  },
);
