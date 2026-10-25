import './graph/setup';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { workspace } from './fixtures/workspace';
import { openApp, openSideBar } from './helpers';

// A list of one kind is titled by that kind ("Domain rules"); one of several kinds stays "Children"
// or "Members". The title, the list's accessible name and its search box all follow.

const wiki = () => screen.getByRole('region', { name: 'Wiki pane' });
// The side bar's Details holds a product's and a domain's own facts, their overview being the page (brief 64).
const sideBar = () => screen.getByRole('complementary', { name: 'Side bar' });
/** The side bar never repeats a list the wiki shows (brief 64). */
const noListInSideBar = (name: RegExp) => { expect(within(sideBar()).queryByRole('list', { name })).toBeNull(); expect(within(sideBar()).queryByRole('heading', { name })).toBeNull(); };

describe('list titles', () => {
  it('LA-BRW-T340 A list of children or members of one kind is titled by that kind, in the wiki and the side bar', async () => {
    // An aggregate's domain rules: the record page says "Domain rules"; the side bar does not repeat them.
    openSideBar();
    await openApp('/DM-SHOP-A1');
    await screen.findByRole('heading', { level: 1, name: 'Basket' });
    const rules = within(wiki()).getByRole('heading', { level: 2, name: /^Domain rules/ });
    expect(rules).toHaveTextContent('Domain rules1');
    expect(within(wiki()).queryByRole('heading', { name: /^Children/ })).toBeNull();
    expect(within(wiki()).getByRole('list', { name: 'Domain rules of DM-SHOP-A1' })).toBeInTheDocument();
    noListInSideBar(/^Domain rules/);

    // A use case's requirements, and the nested list under a row, are named by their kind too.
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    noListInSideBar(/^UC requirements/);
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    fireEvent.click(within(wiki()).getByRole('button', { name: 'Expand DM-SHOP-UC01' }));
    expect(within(wiki()).getByRole('list', { name: 'UC requirements of DM-SHOP-UC01' })).toBeInTheDocument();

    // Children of several kinds stay "Children", each row tagged by its kind: a product's, on its one page, in the
    // side bar's Details, as the product's overview does not list them as children.
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(within(sideBar()).getByRole('heading', { level: 3, name: /^Children/ })).toBeInTheDocument();
    const mixed = within(sideBar()).getByRole('list', { name: 'Children' });
    expect(within(mixed).getAllByText('Domain', { selector: 'small' }).length).toBeGreaterThan(0);

    // A group's members are titled by their kind, in the wiki only.
    await openApp('/DM-SHOP/design/interaction-design/view');
    await screen.findByRole('heading', { level: 1, name: /^Views/ });
    expect(within(wiki()).getByRole('heading', { level: 2, name: /^Views/ })).toHaveTextContent('Views1');
    expect(within(wiki()).queryByRole('heading', { name: /^Members/ })).toBeNull();
    expect(within(wiki()).getByRole('list', { name: 'Views of DM-SHOP/design/interaction-design/view' })).toBeInTheDocument();
    noListInSideBar(/^Views/);

    // The title reads the workspace's kind label, so a renamed kind shows its own name.
    const w = workspace();
    w.kinds = w.kinds.map((k) => (k.kind === 'domain_rule' ? { ...k, label: 'Invariant' } : k));
    await openApp('/DM-SHOP-A1', { workspace: w });
    await screen.findByRole('heading', { level: 1, name: 'Basket' });
    expect(within(wiki()).getByRole('heading', { level: 2, name: /^Invariants/ })).toBeInTheDocument();
  });
});
