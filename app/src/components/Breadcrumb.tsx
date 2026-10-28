import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from '../router';

// The one breadcrumb (LA-PAT-APP-UX-R15): every trail of places above a page, in the header
// strip, the wiki card and the phone's top bar, is this component. A trail of up to three items
// shows in full; a longer one shows its first item (the product), a "…" button and its last item
// (the immediate parent). The button opens a menu of the hidden levels, each a link, reached by
// Tab and the arrow keys, labeled, and closed by Escape (focus back on the button) or a click
// elsewhere. Each item is one line, cut with an ellipsis, its whole name in its tooltip.

export interface Crumb {
  /** The place's address. */
  to: string;
  /** Its name: a record's title, a group's name. */
  label: string;
  /** Its whole name, when the label leaves part out ("Use cases of LA-EXP"). */
  full?: string;
}

/** The most items a trail shows in full; a longer trail collapses its middle. */
export const CRUMBS_SHOWN = 3;

/** What a trail shows: every item, or the first, the hidden middle and the last. */
export function collapseCrumbs<T>(items: readonly T[]): { first: T[]; hidden: T[]; last: T[] } {
  if (items.length <= CRUMBS_SHOWN) return { first: [...items], hidden: [], last: [] };
  return { first: [items[0]], hidden: items.slice(1, -1), last: [items[items.length - 1]] };
}

export interface BreadcrumbProps {
  items: readonly Crumb[];
  /** The landmark's name: "Breadcrumb" by default; a second trail on a page names itself apart. */
  label?: string;
  className?: string;
  /** Follows an item: by default the router's navigate. */
  onFollow?: (to: string) => void;
}

export function Breadcrumb({ items, label = 'Breadcrumb', className, onFollow }: BreadcrumbProps) {
  const { first, hidden, last } = collapseCrumbs(items);
  const item = (c: Crumb, key: string) => (
    <li key={key} className="crumb">
      <Link
        to={c.to}
        className="crumb-link"
        title={c.full ?? c.label}
        aria-label={c.full}
        onClick={onFollow ? (e) => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onFollow(c.to); } } : undefined}
      >{c.label}</Link>
    </li>
  );
  return (
    <nav className={`breadcrumb${className ? ` ${className}` : ''}`} aria-label={label}>
      <ol>
        {first.map((c, i) => item(c, `f${i}`))}
        {hidden.length > 0 && <li className="crumb crumb-more"><HiddenLevels items={hidden} onFollow={onFollow} /></li>}
        {last.map((c, i) => item(c, `l${i}`))}
      </ol>
    </nav>
  );
}

/** The "…" button and its menu of the levels a long trail hides. */
function HiddenLevels({ items, onFollow }: { items: readonly Crumb[]; onFollow?: (to: string) => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const id = useId();
  const links = () => [...(menu.current?.querySelectorAll<HTMLAnchorElement>('a') ?? [])];
  const close = (refocus: boolean) => { setOpen(false); if (refocus) setTimeout(() => button.current?.focus(), 0); };

  // Opened, the menu takes focus on its first link; a press outside it closes it.
  useEffect(() => {
    if (!open) return;
    links()[0]?.focus();
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open]);

  const onMenuKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const all = links();
    const at = all.indexOf(document.activeElement as HTMLAnchorElement);
    let to: number | null = null;
    if (e.key === 'ArrowDown') to = (at + 1) % all.length;
    else if (e.key === 'ArrowUp') to = (at - 1 + all.length) % all.length;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = all.length - 1;
    if (to !== null) { e.preventDefault(); all[to]?.focus(); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'Tab') setOpen(false);
  };

  const count = items.length;
  return (
    <>
      <button
        ref={button}
        type="button"
        className="crumb-more-button"
        aria-label={`${count} hidden ${count === 1 ? 'level' : 'levels'}`}
        title={items.map((c) => c.full ?? c.label).join(' › ')}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >…</button>
      {open && (
        <ul ref={menu} id={id} className="crumb-menu" aria-label="Hidden levels" onKeyDown={onMenuKey}>
          {items.map((c, i) => (
            <li key={i}>
              <Link
                to={c.to}
                className="crumb-menu-link"
                title={c.full ?? c.label}
                aria-label={c.full}
                onClick={(e) => {
                  setOpen(false);
                  if (onFollow && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onFollow(c.to); }
                }}
              >{c.label}</Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
