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

// An address that starts with `?` is a patch of the current one (LA-PAT-APP-UX-R19): each of its
// parameters replaces that parameter of the current address, moved to the end (so the order of the
// parameters is the order things were opened in), and an empty one removes it; the path stays, and
// a hash in the patch is kept. A tool over the stage is opened this way (`?panel=checks`), so the
// stage under it keeps its place and the tool is still a link.

let patchBase: () => string = () => window.location.pathname;
/** Sets the path a patch applies to when the address is not a page of its own (the products picker's stage behind it). */
export function setPatchBase(base: () => string) { patchBase = base; }

let carry: (to: string, from: URLSearchParams) => string = (to) => to;
/** Sets what a move to a new path carries over from the address it leaves (the tools open over the stage). */
export function setCarry(fn: (to: string, from: URLSearchParams) => string) { carry = fn; }

/** The address a link leads to: a patch applied to the current address, or the address itself. */
export function resolveAddress(to: string, search = window.location.search): string {
  if (!to.startsWith('?')) return to;
  const hashAt = to.indexOf('#');
  const hash = hashAt < 0 ? '' : to.slice(hashAt);
  const patch = new URLSearchParams(hashAt < 0 ? to : to.slice(0, hashAt));
  const params = new URLSearchParams(search);
  for (const [key, value] of patch) {
    params.delete(key);
    if (value !== '') params.set(key, value);
  }
  // A slash reads as itself in a query (`?page=format/kinds/use_case`).
  const query = params.toString().replace(/%2F/gi, '/');
  return `${patchBase()}${query ? `?${query}` : ''}${hash}`;
}

export function navigate(to: string, replace = false) {
  to = to.startsWith('?') ? resolveAddress(to) : carry(to, new URLSearchParams(window.location.search));
  if (window.location.pathname + window.location.search + window.location.hash === to) return;
  if (!replace) for (const fn of leaving) fn();
  lastMove = replace ? 'replace' : 'push';
  // Replacing the entry (a view switched on the same page) keeps what was noted in it.
  if (replace) window.history.replaceState(window.history.state, '', to);
  else window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(NAVIGATE));
}

/** The current pathname, query string and hash, updated on back/forward and on navigate(). */
export function useLocation() {
  const read = () => ({ path: window.location.pathname, search: window.location.search, hash: window.location.hash });
  const [location, setLocation] = useState(read);
  useEffect(() => {
    const update = () => setLocation((l) => {
      const next = read();
      return next.path === l.path && next.search === l.search && next.hash === l.hash ? l : next;
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

type LinkProps = { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>;

/** A real <a href> that navigates in place on a plain click, and opens normally with a modifier key. */
export function Link(props: LinkProps) {
  return props.to.startsWith('?') ? <PatchLink {...props} /> : <PlainLink {...props} />;
}

/** A link to a patch of the current address: its href follows the address. */
function PatchLink({ to, ...rest }: LinkProps) {
  const { search } = useLocation();
  return <PlainLink {...rest} to={to} href={resolveAddress(to, search)} />;
}

function PlainLink({ to, onClick, href, ...rest }: LinkProps) {
  return (
    <a
      href={href ?? to}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to);
        if (!to.startsWith('?')) window.scrollTo(0, 0);
      }}
    />
  );
}
