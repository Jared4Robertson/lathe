import { forwardRef, useEffect, useRef, type KeyboardEvent } from 'react';
import { Icon } from '../components/icons';
import { groupLabel } from '../graph/model';
import { Link } from '../router';
import { parseSpecRoute, type SpecIndex } from '../specs/data';
import { addressOf, HOME_PATH, focusOf, isFocusRoute, viewsFromSearch, withView } from '../views/address';
import { QuickFind } from './QuickFind';
import { trapTab } from './useNarrow';
import { Button } from '../components/Button';

// The phone layout's shell (notes/mobile-design.md): a compact top bar with the menu, the page's
// title on one line under a one-step breadcrumb up to its parent, and quick find; and quick find
// as a full-screen sheet.

export interface Heading {
  title: string;
  /** One step up: the parent record, the product of a domain, or all products. */
  up: { to: string; label: string } | null;
}

const PRODUCTS = { to: HOME_PATH, label: 'Products' };

/** The title of the page at an address, and the page one step up from it. */
export function pageHeading(index: SpecIndex | null, path: string, search: string): Heading {
  const route = parseSpecRoute(path, index);
  // Going up keeps the view in front, as following any link does.
  const views = viewsFromSearch(search);
  const keep = (to: string) => (views ? withView(to, views) : to);
  if (!route) return { title: 'Lathe', up: null };
  if (route.page === 'specs') return { title: 'Products', up: null };
  if (route.page === 'checks') {
    const product = index?.byId.get(route.product);
    return { title: 'Checks', up: product ? { to: addressOf(product.id), label: product.title } : PRODUCTS };
  }
  if (route.page === 'format') return { title: 'Record format', up: null };
  const FORMAT = { to: '/format', label: 'Record format' };
  if (route.page === 'format-kind') return { title: index?.kinds.get(route.kind)?.label ?? route.kind, up: FORMAT };
  if (route.page === 'format-check') return { title: route.check, up: FORMAT };
  if (!isFocusRoute(route) || !index) return { title: 'Lathe', up: null };
  const id = focusOf(route);
  if (route.page === 'group') {
    const parent = index.byId.get(route.parent);
    return { title: groupLabel(index, id), up: parent ? { to: keep(addressOf(parent.id)), label: parent.title } : PRODUCTS };
  }
  const record = index.byId.get(id);
  if (!record) return { title: id, up: PRODUCTS };
  if (route.page === 'domain') {
    const product = index.byId.get(route.product);
    return { title: record.title, up: product ? { to: keep(addressOf(product.id)), label: product.title } : PRODUCTS };
  }
  const parent = record.parent ? index.byId.get(record.parent) : undefined;
  return { title: record.title, up: parent ? { to: keep(addressOf(parent.id)), label: parent.title } : PRODUCTS };
}

export interface TopBarProps {
  heading: Heading;
  navOpen: boolean;
  onMenu: () => void;
  onFind: () => void;
}

/** The phone's top bar: the menu, the breadcrumb and title, and quick find. */
export const TopBar = forwardRef<HTMLButtonElement, TopBarProps>(function TopBar({ heading, navOpen, onMenu, onFind }, menuRef) {
  return (
    <header className="topbar">
      <Button
        variant="icon"
        ref={menuRef}
        label="Open the navigation"
        aria-expanded={navOpen}
        aria-controls="nav"
        onClick={onMenu}
      >
        <Icon name="menu" />
      </Button>
      <div className="topbar-heading">
        {heading.up && (
          <Link to={heading.up.to} className="topbar-up" aria-label={`Up to ${heading.up.label}`}>
            <Icon name="chevron-left" size={14} />
            <span className="topbar-up-label">{heading.up.label}</span>
          </Link>
        )}
        <p className="topbar-title" title={heading.title}>{heading.title}</p>
      </div>
      <Button variant="icon" label="Quick find" aria-haspopup="dialog" onClick={onFind}>
        <Icon name="search" />
      </Button>
    </header>
  );
});

/** Quick find as a full-screen sheet: the search box at the top, the results below it, Escape or Close to leave. */
export function QuickFindSheet({ index, onClose }: { index: SpecIndex | null; onClose: () => void }) {
  const sheet = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => { if (before?.isConnected) before.focus(); };
  }, []);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); return; }
    trapTab(e, sheet.current);
  };
  return (
    <div ref={sheet} className="sheet find-sheet" role="dialog" aria-modal="true" aria-label="Quick find" onKeyDown={onKeyDown}>
      <QuickFind
        ref={input}
        index={index}
        onGo={onClose}
        inline
        trailing={<Button className="sheet-close" onClick={onClose}>Close</Button>}
      />
    </div>
  );
}
