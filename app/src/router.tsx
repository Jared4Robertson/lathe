import { useEffect, useState, type AnchorHTMLAttributes } from 'react';

// Hand-rolled History API routing, shared by Diagrams and Specs.

const NAVIGATE = 'lathe:navigate';

export function navigate(to: string, replace = false) {
  if (window.location.pathname + window.location.search === to) return;
  if (replace) window.history.replaceState(null, '', to);
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
