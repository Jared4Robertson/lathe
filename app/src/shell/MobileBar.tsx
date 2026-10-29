import { forwardRef } from 'react';
import { Icon } from '../components/icons';
import { groupLabel } from '../graph/model';
import { parseSpecRoute, type SpecIndex } from '../specs/data';
import { addressOf, HOME_PATH, focusOf, isFocusRoute, stageFromSearch, withStage } from '../views/address';
import { Breadcrumb } from './Breadcrumb';
import { Button } from '../components/Button';

// The phone layout's shell (notes/mobile-design.md): a compact top bar with the menu, the page's
// title on one line under a one-step breadcrumb (the one Breadcrumb) up to its parent, and a button that opens quick
// find (QuickOpen.tsx), a full-width sheet at the top on a phone.

export interface Heading {
  title: string;
  /** One step up: the parent record, the product of a domain, or all products. */
  up: { to: string; label: string } | null;
}

const PRODUCTS = { to: HOME_PATH, label: 'Products' };

/** The title of the page at an address, and the page one step up from it. */
export function pageHeading(index: SpecIndex | null, path: string, search: string): Heading {
  const route = parseSpecRoute(path, index);
  // Going up keeps the stage, as following any link does.
  const stage = stageFromSearch(search);
  const keep = (to: string) => (stage ? withStage(to, stage) : to);
  if (route.page === 'specs') return { title: 'Products', up: null };
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
        {heading.up && <Breadcrumb items={[{ to: heading.up.to, label: heading.up.label, full: `Up to ${heading.up.label}` }]} label="Up" className="topbar-trail" />}
        <p className="topbar-title" title={heading.title}>{heading.title}</p>
      </div>
      <Button variant="icon" label="Quick find" aria-haspopup="dialog" onClick={onFind}>
        <Icon name="search" />
      </Button>
    </header>
  );
});
