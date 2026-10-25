import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { main, openApp, openSideBar, section, sideBar } from './helpers';

// Wiki pages and the side bar show one level below their record; deeper levels are folded under
// a disclosure triangle, with their counts and marks still on the folded row.

const row = (scope: HTMLElement, id: string) => within(scope).getByRole('link', { name: new RegExp(`^${id}(?![-\\d])`) }).closest('li') as HTMLElement;

describe('one level deep', () => {
  it('LA-EXP-T50 Folded rows keep their counts and marks, open and close by button, Expand all or arrow keys, and stay open while moving around', async () => {
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const useCases = section(/^Capabilities/);
    const uc = row(useCases, 'DM-SHOP-UC01');
    // Folded by default, with the count of what it holds and a mark for a gap below it.
    const toggle = within(uc).getByRole('button', { name: 'Expand DM-SHOP-UC01' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(uc).toHaveTextContent('2 UC requirements');
    expect(uc.querySelector('ul.nested')).toBeNull();
    const aggregates = section(/^Domain model/);
    expect(row(aggregates, 'DM-SHOP-A1')).toHaveTextContent('1 domain rule');

    // The button opens and closes it.
    fireEvent.click(toggle);
    expect(within(uc).getByRole('button', { name: 'Collapse DM-SHOP-UC01' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(uc).getByRole('link', { name: /DM-SHOP-UC01-R02/ }).closest('li')).toHaveTextContent('not proved');

    // Left closes it (focus on the row), Right opens it, Right again moves into it, Left goes back up.
    const open = within(uc).getByRole('button', { name: 'Collapse DM-SHOP-UC01' });
    open.focus();
    fireEvent.keyDown(open, { key: 'ArrowLeft' });
    expect(uc.querySelector('ul.nested')).toBeNull();
    fireEvent.keyDown(within(uc).getByRole('button', { name: 'Expand DM-SHOP-UC01' }), { key: 'ArrowRight' });
    expect(uc.querySelector('ul.nested')).not.toBeNull();
    fireEvent.keyDown(within(uc).getByRole('button', { name: 'Collapse DM-SHOP-UC01' }), { key: 'ArrowRight' });
    const child = document.activeElement as HTMLElement;
    expect(child.textContent).toContain('DM-SHOP-UC01-R01');
    fireEvent.keyDown(child, { key: 'ArrowLeft' });
    expect(within(uc).getByRole('button', { name: 'Collapse DM-SHOP-UC01' })).toHaveFocus();

    // Expand all and Collapse all, per section.
    const user = userEvent.setup();
    await user.click(within(aggregates).getByRole('button', { name: 'Expand all' }));
    expect(row(aggregates, 'DM-SHOP-A1').querySelector('ul.nested')).not.toBeNull();
    expect(within(aggregates).getByRole('button', { name: 'Collapse all' })).toBeInTheDocument();

    // What is open stays open while moving around (for the session).
    await openApp('/DM');
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(row(section(/^Domain model/), 'DM-SHOP-A1').querySelector('ul.nested')).not.toBeNull();
    expect(row(section(/^Capabilities/), 'DM-SHOP-UC01').querySelector('ul.nested')).not.toBeNull();
  });

  it('LA-EXP-T51 A record page shows its direct children with theirs folded, in the wiki and the side bar, and a product page lists its domains but not their contents', async () => {
    openSideBar();
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const wiki = screen.getByRole('region', { name: 'Wiki pane' });
    // A domain's one page lists its records in their folders, each with its own children folded.
    const children = within(wiki).getByRole('heading', { name: /^Capabilities/ }).closest('section') as HTMLElement;
    const uc = row(children, 'DM-SHOP-UC01');
    expect(uc).toHaveTextContent('2 UC requirements');
    expect(uc.querySelector('ul.nested')).toBeNull();
    expect(within(children).queryByRole('link', { name: /DM-SHOP-UC01-R01/ })).toBeNull();

    // On a record's page the side bar does not repeat the children the wiki lists (brief 64).
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(within(main()).getByRole('list', { name: 'UC requirements of DM-SHOP-UC01' })).toBeInTheDocument();
    expect(within(sideBar()).queryByRole('list', { name: /^UC requirements/ })).toBeNull();

    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const domains = section(/^Domains/);
    expect(within(domains).getByRole('link', { name: /DM-SHOP\s*Shopping/ })).toBeInTheDocument();
    expect(within(main()).queryByRole('link', { name: /^DM-SHOP-UC01(?!-)/ })).toBeNull();
  });
});
