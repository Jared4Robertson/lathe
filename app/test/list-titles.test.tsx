import './graph/setup';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { workspace } from './fixtures/workspace';
import { openApp, openSideBar } from './helpers';

// A list of one kind is titled by that kind ("Constraints"); one of several kinds stays "Children"
// or "Members". The title, the list's accessible name and its search box all follow.

const wiki = () => screen.getByRole('region', { name: 'Wiki pane' });
// The side bar's Details holds a product's and a domain's own facts, their overview being the page (brief 64).
const sideBar = () => screen.getByRole('complementary', { name: 'Side bar' });
/** The side bar never repeats a list the wiki shows (brief 64). */
const noListInSideBar = (name: RegExp) => { expect(within(sideBar()).queryByRole('list', { name })).toBeNull(); expect(within(sideBar()).queryByRole('heading', { name })).toBeNull(); };

describe('list titles', () => {
  it('LA-V92-R09-T02 A list of children or members of one kind is titled by that kind, in the wiki and the side bar', async () => {
    // A value object's constraints: the record page says "Constraints"; the side bar does not repeat them.
    openSideBar();
    await openApp('/DM-VO01');
    await screen.findByRole('heading', { level: 1, name: 'Quantity' });
    const rules = within(wiki()).getByRole('heading', { level: 2, name: /^Constraints/ });
    expect(rules).toHaveTextContent('Constraints1');
    expect(within(wiki()).queryByRole('heading', { name: /^Children/ })).toBeNull();
    expect(within(wiki()).getByRole('list', { name: 'Constraints of DM-VO01' })).toBeInTheDocument();
    noListInSideBar(/^Constraints/);

    // A use case's UC requirements, and the nested list under a row, are named by their kind too.
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    noListInSideBar(/^UC requirements/);
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    fireEvent.click(within(wiki()).getByRole('button', { name: 'Expand DM-SHOP-CAP01' }));
    expect(within(wiki()).getByRole('list', { name: 'Use cases of DM-SHOP-CAP01' })).toBeInTheDocument();

    // Children of several kinds stay "Children", each row tagged by its kind: a product's, on its one page, in the
    // side bar's Details, as the product's overview does not list them as children.
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(within(sideBar()).getByRole('heading', { level: 3, name: /^Children/ })).toBeInTheDocument();
    const mixed = within(sideBar()).getByRole('list', { name: 'Children' });
    expect(within(mixed).getAllByText('Domain', { selector: 'small' }).length).toBeGreaterThan(0);

    // A group's members are titled by their kind, in the wiki only.
    await openApp('/DM-SHOP/interaction-design/flow');
    await screen.findByRole('heading', { level: 1, name: /^Flows/ });
    expect(within(wiki()).getByRole('heading', { level: 2, name: /^Flows/ })).toHaveTextContent('Flows1');
    expect(within(wiki()).queryByRole('heading', { name: /^Members/ })).toBeNull();
    expect(within(wiki()).getByRole('list', { name: 'Flows of DM-SHOP/interaction-design/flow' })).toBeInTheDocument();
    noListInSideBar(/^Flows/);

    // The title reads the workspace's kind label, so a renamed kind shows its own name.
    const w = workspace();
    w.schema.kinds.constraint.label = 'Rule';
    await openApp('/DM-VO01', { data: w });
    await screen.findByRole('heading', { level: 1, name: 'Quantity' });
    expect(within(wiki()).getByRole('heading', { level: 2, name: /^Rules/ })).toBeInTheDocument();
  });
});
