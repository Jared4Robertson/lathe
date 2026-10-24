import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { main, openApp, section } from './helpers';

// Wiki pages and the inspector show one level below their record; deeper levels are folded under
// a disclosure triangle, with their counts and marks still on the folded row.

const row = (scope: HTMLElement, id: string) => within(scope).getByRole('link', { name: new RegExp(`^${id}(?![-\\d])`) }).closest('li') as HTMLElement;

describe('one level deep', () => {
  it('LA-BRW-T133 Folded rows keep their counts and marks, open and close by button, Expand all or arrow keys, and stay open while moving around', async () => {
    await openApp('/specs/DM/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const useCases = section(/^Use cases/);
    const uc = row(useCases, 'DM-SHOP-UC01');
    // Folded by default, with the count of what it holds and a mark for a gap below it.
    const toggle = within(uc).getByRole('button', { name: 'Expand DM-SHOP-UC01' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(uc).toHaveTextContent('2 requirements');
    expect(uc.querySelector('ul.nested')).toBeNull();
    const aggregates = section(/^Aggregates/);
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
    await openApp('/specs/DM');
    await openApp('/specs/DM/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(row(section(/^Aggregates/), 'DM-SHOP-A1').querySelector('ul.nested')).not.toBeNull();
    expect(row(section(/^Use cases/), 'DM-SHOP-UC01').querySelector('ul.nested')).not.toBeNull();
  });

  it('LA-BRW-T134 A record page shows its direct children with theirs folded, in the wiki and the inspector, and a product page lists its domains but not their contents', async () => {
    await openApp('/records/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const wiki = screen.getByRole('region', { name: 'Wiki pane' });
    const children = within(wiki).getByRole('heading', { name: /^Children/ }).closest('section') as HTMLElement;
    const uc = row(children, 'DM-SHOP-UC01');
    expect(uc).toHaveTextContent('2 requirements');
    expect(uc.querySelector('ul.nested')).toBeNull();
    expect(within(children).queryByRole('link', { name: /DM-SHOP-UC01-R01/ })).toBeNull();
    const inspector = screen.getByRole('complementary', { name: 'Inspector' });
    const inInspector = within(within(inspector).getByRole('list', { name: 'Children' }));
    expect(inInspector.getByRole('button', { name: 'Expand DM-SHOP-UC01' })).toHaveAttribute('aria-expanded', 'false');
    expect(inInspector.queryByRole('link', { name: /DM-SHOP-UC01-R01/ })).toBeNull();

    await openApp('/specs/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const domains = section(/^Domains/);
    expect(within(domains).getByRole('link', { name: /DM-SHOP\s*Shopping/ })).toBeInTheDocument();
    expect(within(main()).queryByRole('link', { name: /^DM-SHOP-UC01(?!-)/ })).toBeNull();
  });
});
