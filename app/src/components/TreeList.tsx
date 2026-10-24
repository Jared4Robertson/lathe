import { useEffect, useId, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { LongList } from './LongList';
import { Icon } from './icons';

// A list of rows, each of which can hold one level of nested rows, folded by default.
//
// A wiki page shows one level below its own record; anything deeper sits under a disclosure
// triangle on its row. The row keeps its count of nested items and its marks when folded, so
// nothing hidden is forgotten. What is open is remembered for the session, across pages. A search
// (the list's own, or one the page passes in) opens a row just for the match, without
// remembering it. Right arrow opens a row, Left closes it or moves to its parent, as in a tree
// view. Lists past ten rows scroll inside, as every LongList does.

const KEY = 'lathe:expanded';

function readOpen(): Set<string> {
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(KEY) ?? '[]');
    return new Set(Array.isArray(stored) ? stored.filter((s): s is string => typeof s === 'string') : []);
  } catch {
    return new Set();
  }
}

let open: ReadonlySet<string> = readOpen();
const listeners = new Set<() => void>();
/** Every mounted tree's foldable rows, so "Expand all" and "Collapse all" reach the whole page. */
const mounted = new Map<string, readonly string[]>();

function setOpen(next: ReadonlySet<string>) {
  open = next;
  try { window.sessionStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* storage unavailable */ }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => open;

export function setExpanded(ids: readonly string[], value: boolean) {
  const next = new Set(open);
  for (const id of ids) if (value) next.add(id); else next.delete(id);
  setOpen(next);
}
/** Opens or closes every foldable row on the page (the "Expand all" and "Collapse all" commands). */
export function expandAllOnPage(value: boolean) {
  setExpanded([...mounted.values()].flat(), value);
}
/** Forgets what was opened (for tests). */
export function resetExpanded() { setOpen(new Set()); }

export interface TreeListProps<T> {
  items: readonly T[];
  /** The nested rows of an item (one level only). */
  nestedOf: (item: T) => readonly T[];
  /** One row's contents (without its nested rows). */
  renderRow: (item: T) => ReactNode;
  itemKey: (item: T) => string;
  searchText: (item: T) => string;
  /** The words for an item's nested rows, by count: "4 requirements". */
  countLabel: (item: T, nested: readonly T[]) => string;
  label: string;
  /** What the nested list of an item is called, for screen readers. */
  nestedLabel: (item: T) => string;
  className?: string;
  /** A search from the page (such as a domain's record filter), applied to rows and nested rows. */
  query?: string;
  /** Hide the Expand all / Collapse all control (lists of one). */
  bulk?: boolean;
}

const matchOf = (text: string, q: string) => !q || text.toLowerCase().includes(q);

export function TreeList<T>({ items, nestedOf, renderRow, itemKey, searchText, countLabel, label, nestedLabel, className = 'record-list tree', query = '', bulk = true }: TreeListProps<T>) {
  const opened = useSyncExternalStore(subscribe, snapshot, snapshot);
  const scope = useId();
  const pageQ = query.trim().toLowerCase();
  const foldable = items.filter((i) => nestedOf(i).length > 0).map(itemKey);
  const foldableKey = foldable.join('\n');

  useEffect(() => {
    mounted.set(scope, foldableKey ? foldableKey.split('\n') : []);
    return () => { mounted.delete(scope); };
  }, [scope, foldableKey]);

  // With a page search, keep the rows that match or hold a match.
  const visible = pageQ ? items.filter((i) => matchOf(searchText(i), pageQ) || nestedOf(i).some((n) => matchOf(searchText(n), pageQ))) : items;
  const allOpen = foldable.length > 0 && foldable.every((k) => opened.has(k));

  const onRowKey = (item: T, e: KeyboardEvent<HTMLLIElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, [contenteditable="true"]')) return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const row = e.currentTarget;
    const toggle = () => row.querySelector<HTMLElement>('.tree-row .tree-toggle');
    const ownRow = target.closest('li');
    if (ownRow !== row) {
      // Left on a nested row moves to its parent row.
      if (e.key === 'ArrowLeft' && ownRow && row.contains(ownRow)) { e.preventDefault(); toggle()?.focus(); }
      return;
    }
    const key = itemKey(item);
    if (nestedOf(item).length === 0) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (!opened.has(key)) setExpanded([key], true);
      else row.querySelector<HTMLElement>('.tree-nested li a, .tree-nested li button')?.focus();
    } else if (e.key === 'ArrowLeft' && opened.has(key)) {
      e.preventDefault();
      setExpanded([key], false);
      toggle()?.focus();
    }
  };

  const tools = bulk && foldable.length > 0 ? (
    <button type="button" className="tree-bulk" onClick={() => setExpanded(foldable, !allOpen)}>
      {allOpen ? 'Collapse all' : 'Expand all'}
    </button>
  ) : undefined;

  return (
    <LongList
      label={label}
      className={className}
      items={visible}
      itemKey={itemKey}
      searchText={(i) => [i, ...nestedOf(i)].map(searchText).join(' ')}
      itemClassName={() => 'tree-item'}
      tools={tools}
      onItemKeyDown={onRowKey}
      render={(item, listQ) => {
        const key = itemKey(item);
        const nested = nestedOf(item);
        const q = [pageQ, listQ].filter(Boolean);
        const nestedMatch = (n: T) => q.every((w) => matchOf(searchText(n), w));
        // A search opens the row just for the match (shown, not remembered).
        const revealed = q.length > 0 && nested.some(nestedMatch) && !q.every((w) => matchOf(searchText(item), w));
        const isOpen = opened.has(key) || revealed;
        const shown = revealed ? nested.filter(nestedMatch) : nested;
        return (
          <>
            <div className="tree-row">
              {nested.length > 0 ? (
                <button
                  type="button"
                  className="tree-toggle"
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${key}`}
                  onClick={() => setExpanded([key], !opened.has(key))}
                >
                  <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={14} />
                </button>
              ) : <span className="tree-toggle-space" aria-hidden="true" />}
              <div className="tree-row-body">{renderRow(item)}</div>
              {nested.length > 0 && <small className="tree-count">{countLabel(item, nested)}</small>}
            </div>
            {isOpen && nested.length > 0 && (
              <div className="tree-nested">
                <LongList
                  label={nestedLabel(item)}
                  className="record-list nested"
                  items={shown}
                  itemKey={itemKey}
                  searchText={searchText}
                  render={(n) => renderRow(n)}
                />
              </div>
            )}
          </>
        );
      }}
    />
  );
}
