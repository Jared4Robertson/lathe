import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { main, openApp, section, stageOf } from './helpers';

// Wiki pages show one level below their record; deeper levels are folded under
// a disclosure triangle, with their counts and marks still on the folded row.

const row = (scope: HTMLElement, id: string) => within(scope).getByRole('link', { name: new RegExp(`^${id}(?![-\\d])`) }).closest('li') as HTMLElement;

describe('one level deep', () => {
  const proveLaV92R21T01 = async () => {
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    // Use cases holds only capabilities, so it lists them itself.
    const capabilities = stageOf('use-cases');
    const cap = row(capabilities, 'DM-SHOP-CAP01');
    // Folded by default, with the count of what it holds.
    const toggle = within(cap).getByRole('button', { name: 'Expand DM-SHOP-CAP01' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(cap).toHaveTextContent('1 use case');
    expect(cap.querySelector('ul.nested')).toBeNull();
    // An aggregate folds what sits under it in the domain model: its entities, invariant, event and command.
    const aggregates = section(/^Aggregates/);
    expect(row(aggregates, 'DM-SHOP-A1')).toHaveTextContent('5 children');

    // The button opens and closes it, showing the use case within with its actor.
    fireEvent.click(toggle);
    expect(within(cap).getByRole('button', { name: 'Collapse DM-SHOP-CAP01' })).toHaveAttribute('aria-expanded', 'true');
    expect(row(cap, 'DM-SHOP-UC01')).toHaveTextContent('Shopper');

    // Left closes it (focus on the row), Right opens it, Right again moves into it, Left goes back up.
    const open = within(cap).getByRole('button', { name: 'Collapse DM-SHOP-CAP01' });
    open.focus();
    fireEvent.keyDown(open, { key: 'ArrowLeft' });
    expect(cap.querySelector('ul.nested')).toBeNull();
    fireEvent.keyDown(within(cap).getByRole('button', { name: 'Expand DM-SHOP-CAP01' }), { key: 'ArrowRight' });
    expect(cap.querySelector('ul.nested')).not.toBeNull();
    fireEvent.keyDown(within(cap).getByRole('button', { name: 'Collapse DM-SHOP-CAP01' }), { key: 'ArrowRight' });
    const child = document.activeElement as HTMLElement;
    expect(child.textContent).toContain('DM-SHOP-UC01');
    fireEvent.keyDown(child, { key: 'ArrowLeft' });
    expect(within(cap).getByRole('button', { name: 'Collapse DM-SHOP-CAP01' })).toHaveFocus();

    // Expand all and Collapse all, per section.
    const user = userEvent.setup();
    await user.click(within(aggregates).getByRole('button', { name: 'Expand all' }));
    expect(row(aggregates, 'DM-SHOP-A1').querySelector('ul.nested')).not.toBeNull();
    expect(within(aggregates).getByRole('button', { name: 'Collapse all' })).toBeInTheDocument();

    // What is open stays open while moving around (for the session).
    await openApp('/DM');
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(row(section(/^Aggregates/), 'DM-SHOP-A1').querySelector('ul.nested')).not.toBeNull();
    expect(row(stageOf('use-cases'), 'DM-SHOP-CAP01').querySelector('ul.nested')).not.toBeNull();
  };
  it('LA-V92-R21-T01 Folded rows keep their counts and marks, open and close by button, Expand all or arrow keys, and stay open while moving around', proveLaV92R21T01);
  it('LA-V92-R02-T01 Folded rows keep counts and marks and open by button, Expand all or arrow keys', proveLaV92R21T01);
  it('LA-V92-R03-T01 Folded rows open by button, Expand all or arrow keys, and stay open while moving around', proveLaV92R21T01);

  const proveLaV92R21T02 = async () => {
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const wiki = screen.getByRole('region', { name: 'Wiki card' });
    // A domain's one page lists its records in their stages and folders, each with its own children folded.
    const children = stageOf('use-cases', wiki);
    const cap = row(children, 'DM-SHOP-CAP01');
    expect(cap).toHaveTextContent('1 use case');
    expect(cap.querySelector('ul.nested')).toBeNull();
    expect(within(children).queryByRole('link', { name: /DM-SHOP-UC01/ })).toBeNull();

    // A record's page: the wiki lists its children.
    await openApp('/DM-SHOP-CAP01');
    await screen.findByRole('heading', { level: 1, name: 'Buying' });
    expect(within(main()).getByRole('list', { name: 'Use cases of DM-SHOP-CAP01' })).toBeInTheDocument();

    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const domains = section(/^Domains/);
    expect(within(domains).getByRole('link', { name: /DM-SHOP\s*Shopping/ })).toBeInTheDocument();
    expect(within(main()).queryByRole('link', { name: /^DM-SHOP-UC01(?!-)/ })).toBeNull();
  };
  it('LA-V92-R21-T02 A product page lists its domains but none of their records', proveLaV92R21T02);
  it('LA-V92-R02-T02 A record page\'s wiki lists its children one level deep', proveLaV92R21T02);
});
