import './graph/setup';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { workspace } from './fixtures/workspace';
import { openApp } from './helpers';

// A list of one kind is titled by that kind ("Domain rules"); one of several kinds stays "Children"
// or "Members". The title, the list's accessible name and its search box all follow.

const wiki = () => screen.getByRole('region', { name: 'Wiki pane' });
const inspector = () => screen.getByRole('complementary', { name: 'Inspector' });

describe('list titles', () => {
  it('LA-BRW-T340 A list of children or members of one kind is titled by that kind, in the wiki and the inspector', async () => {
    // An aggregate's domain rules: the record page and the inspector both say "Domain rules".
    await openApp('/records/DM-SHOP-A1');
    await screen.findByRole('heading', { level: 1, name: 'Basket' });
    const rules = within(wiki()).getByRole('heading', { level: 2, name: /^Domain rules/ });
    expect(rules).toHaveTextContent('Domain rules1');
    expect(within(wiki()).queryByRole('heading', { name: /^Children/ })).toBeNull();
    expect(within(wiki()).getByRole('list', { name: 'Domain rules of DM-SHOP-A1' })).toBeInTheDocument();
    expect(within(inspector()).getByRole('heading', { level: 3, name: /^Domain rules/ })).toHaveTextContent('Domain rules 1');
    expect(within(inspector()).getByRole('list', { name: 'Domain rules' })).toBeInTheDocument();

    // A use case's requirements, and the nested list under a row, are named by their kind too.
    await openApp('/records/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(within(inspector()).getByRole('heading', { level: 3, name: /^UC requirements/ })).toHaveTextContent('UC requirements 2');
    await openApp('/records/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    fireEvent.click(within(wiki()).getByRole('button', { name: 'Expand DM-SHOP-UC01' }));
    expect(within(wiki()).getByRole('list', { name: 'UC requirements of DM-SHOP-UC01' })).toBeInTheDocument();

    // Children of several kinds stay "Children", each row tagged by its kind.
    await openApp('/records/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const mixed = within(wiki()).getByRole('heading', { level: 2, name: /^Children/ }).closest('section') as HTMLElement;
    expect(within(mixed).getAllByText('Domain', { selector: 'small' }).length).toBeGreaterThan(0);
    expect(within(wiki()).getByRole('list', { name: 'Children of DM' })).toBeInTheDocument();
    expect(within(inspector()).getByRole('list', { name: 'Children' })).toBeInTheDocument();

    // A group's members in the inspector are titled by their kind.
    await openApp('/records/DM-SHOP/use_case');
    await screen.findByRole('heading', { level: 1, name: /^Use cases/ });
    expect(within(inspector()).getByRole('heading', { level: 3, name: /^Use cases/ })).toBeInTheDocument();
    expect(within(inspector()).getByRole('list', { name: 'Use cases' })).toBeInTheDocument();

    // The title reads the workspace's kind label, so a renamed kind shows its own name.
    const w = workspace();
    w.kinds = w.kinds.map((k) => (k.kind === 'domain_rule' ? { ...k, label: 'Invariant' } : k));
    await openApp('/records/DM-SHOP-A1', { workspace: w });
    await screen.findByRole('heading', { level: 1, name: 'Basket' });
    expect(within(wiki()).getByRole('heading', { level: 2, name: /^Invariants/ })).toBeInTheDocument();
  });
});
