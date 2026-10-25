import { useEffect, useState, type AnchorHTMLAttributes } from 'react';

// Hand-rolled History API routing for every page.

const NAVIGATE = 'lathe:navigate';

/** How the address last changed: a new entry, the same entry replaced, or Back and Forward. */
export type AddressMove = 'push' | 'replace' | 'pop';
let lastMove: AddressMove = 'push';
/** How the address last changed, so a page can tell Back and Forward (restore where it was) from a new page (start at the top). */
export const lastAddressMove = () => lastMove;
if (typeof window !== 'undefined') window.addEventListener('popstate', () => { lastMove = 'pop'; });

const leaving = new Set<() => void>();
/** Runs `fn` just before navigate() leaves the current history entry, so a page can note in it where it was. */
export function onLeaveEntry(fn: () => void): () => void {
  leaving.add(fn);
  return () => { leaving.delete(fn); };
}

/** What a page noted in the current history entry (see onLeaveEntry), or undefined. */
export function entryState<T>(key: string): T | undefined {
  const state = window.history.state as Record<string, unknown> | null;
  return state && typeof state === 'object' ? (state[key] as T | undefined) : undefined;
}

/** Notes a value in the current history entry, kept through Back and Forward. */
export function noteInEntry(key: string, value: unknown) {
  const state = window.history.state as Record<string, unknown> | null;
  try {
    window.history.replaceState({ ...(state && typeof state === 'object' ? state : {}), [key]: value }, '');
  } catch { /* too many history calls: the note is skipped */ }
}

export function navigate(to: string, replace = false) {
  if (window.location.pathname + window.location.search === to) return;
  if (!replace) for (const fn of leaving) fn();
  lastMove = replace ? 'replace' : 'push';
  // Replacing the entry (a view switched on the same page) keeps what was noted in it.
  if (replace) window.history.replaceState(window.history.state, '', to);
  else window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(NAVIGATE));
}

/** The current pathname, updated on back/forward and on navigate(). */
export function usePath() {
  return useLocation().path;
}

/** The current pathname and query string, updated on back/forward and on navigate(). */
export function useLocation() {
  const read = () => ({ path: window.location.pathname, search: window.location.search });
  const [location, setLocation] = useState(read);
  useEffect(() => {
    const update = () => setLocation((l) => {
      const next = read();
      return next.path === l.path && next.search === l.search ? l : next;
    });
    update();
    window.addEventListener('popstate', update);
    window.addEventListener(NAVIGATE, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(NAVIGATE, update);
    };
  }, []);
  return location;
}

/** A real <a href> that navigates in place on a plain click, and opens normally with a modifier key. */
export function Link({ to, onClick, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={to}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to);
        window.scrollTo(0, 0);
      }}
    />
  );
}
