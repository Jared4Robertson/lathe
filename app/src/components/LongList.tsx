import { lowerLabel } from '../plural';
import { InActionsSlot } from './ActionsSlot';
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

// A list that stays short. Up to `limit` items it is a plain list. With more, it shows the first
// `limit` rows' height and scrolls inside, under a search box that filters the items, with a count
// ("12 of 48") and a message when nothing matches. Nothing here knows about specs, so any view
// (the spec pages, the graph's side panel) can use it.

export const LONG_LIST_LIMIT = 10;

export interface LongListProps<T> {
  items: readonly T[];
  /** The contents of one item's row (the list item itself is made here), given the current search. */
  render: (item: T, query: string) => ReactNode;
  /** The text the search box matches against, such as an ID and a title. */
  searchText: (item: T) => string;
  /** A stable key for an item. */
  itemKey: (item: T) => string;
  /** What the list holds, for screen readers: "Children", "Problems". */
  label: string;
  /** The list's class, such as "record-list". */
  className?: string;
  /** A class for one item's row. */
  itemClassName?: (item: T) => string | undefined;
  ordered?: boolean;
  /** How many rows show before the list scrolls. */
  limit?: number;
  /** Extra controls beside the search box, or for a short list in its heading's actions slot (such as "Expand all"). */
  tools?: ReactNode;
  /** Keys pressed on an item's row (such as the arrow keys of a tree). */
  onItemKeyDown?: (item: T, e: KeyboardEvent<HTMLLIElement>) => void;
}

export function LongList<T>({ items, render, searchText, itemKey, label, className, itemClassName, ordered = false, limit = LONG_LIST_LIMIT, tools, onItemKeyDown }: LongListProps<T>) {
  const [query, setQuery] = useState('');
  const [height, setHeight] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const long = items.length > limit;
  const q = query.trim().toLowerCase();
  const shown = long && q ? items.filter((item) => searchText(item).toLowerCase().includes(q)) : items;

  // Measure the first `limit` rows once, unfiltered, so filtering never makes the box jump.
  useLayoutEffect(() => {
    if (!long || q || !scroller.current) return;
    const list = scroller.current.firstElementChild;
    const last = list?.children[limit - 1] as HTMLElement | undefined;
    if (!last) return;
    const bottom = last.getBoundingClientRect().bottom - scroller.current.getBoundingClientRect().top + scroller.current.scrollTop;
    if (bottom > 0) setHeight(Math.ceil(bottom));
  }, [long, q, limit, items]);

  const Tag = ordered ? 'ol' : 'ul';
  const list = (
    <Tag className={className} aria-label={label}>
      {shown.map((item) => (
        <li key={itemKey(item)} className={itemClassName?.(item)} onKeyDown={onItemKeyDown ? (e) => onItemKeyDown(item, e) : undefined}>
          {render(item, long ? q : '')}
        </li>
      ))}
    </Tag>
  );
  // A short list's tools sit in the heading's row when the heading offers a slot, else above the list.
  if (!long) {
    if (!tools) return list;
    return (
      <>
        <InActionsSlot fallback={(t) => <div className="long-list-tools short">{t}</div>}>{tools}</InActionsSlot>
        {list}
      </>
    );
  }

  return (
    <div className="long-list">
      <div className="long-list-tools">
        <input
          id={searchId}
          type="search"
          value={query}
          placeholder="Filter by ID or title"
          aria-label={`Filter ${lowerLabel(label)}`}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) {
              e.preventDefault();
              e.stopPropagation();
              setQuery('');
            }
          }}
        />
        <span className="long-list-count" aria-live="polite">{shown.length} of {items.length}</span>
        {tools}
      </div>
      <div
        ref={scroller}
        className="long-list-scroll"
        tabIndex={0}
        role="region"
        aria-label={`${label} (scrolls)`}
        style={height ? { maxHeight: `${height}px` } : undefined}
      >
        {shown.length === 0 ? <p className="hint long-list-empty" role="status">Nothing matches “{query.trim()}”.</p> : list}
      </div>
    </div>
  );
}
