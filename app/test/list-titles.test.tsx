import './graph/setup';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { workspace } from './fixtures/workspace';
import { facts, openApp } from './helpers';

// A list of one kind is titled by that kind ("Constraints"); one of several kinds stays "Children"
// or "Members". The title, the list's accessible name and its search box all follow.

const wiki = () => screen.getByRole('region', { name: 'Wiki card' });
/** A record's facts, after its body, never repeat a list the body shows. */
const noListInFacts = (name: RegExp) => { expect(within(facts()).queryByRole('list', { name })).toBeNull(); expect(within(facts()).queryByRole('heading', { name })).toBeNull(); };

describe('list titles', () => {
  it('LA-V92-R09-T02 A list of children or members of one kind is titled by that kind, in the wiki card', async () => {
    // A value object's constraints: the record page says "Constraints"; its facts do not repeat them.
    await openApp('/DM-VO01');
    await screen.findByRole('heading', { level: 1, name: 'Quantity' });
    const rules = within(wiki()).getByRole('heading', { level: 2, name: /^Constraints/ });
    expect(rules).toHaveTextContent('Constraints1');
    expect(within(wiki()).queryByRole('heading', { name: /^Children/ })).toBeNull();
    expect(within(wiki()).getByRole('list', { name: 'Constraints of DM-VO01' })).toBeInTheDocument();
    noListInFacts(/^Constraints/);

    // A use case's UC requirements, and the nested list under a row, are named by their kind too.
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    noListInFacts(/^UC requirements/);
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    fireEvent.click(within(wiki()).getByRole('button', { name: 'Expand DM-SHOP-CAP01' }));
    expect(within(wiki()).getByRole('list', { name: 'Use cases of DM-SHOP-CAP01' })).toBeInTheDocument();

    // Children of several kinds stay "Children", each row tagged by its kind: a command's handler and endpoint.
    await openApp('/DM-SHOP-CMD01');
    await screen.findByRole('heading', { level: 1, name: 'Add item' });
    expect(within(wiki()).getByRole('heading', { level: 2, name: /^Children/ })).toHaveTextContent('Children2');
    const mixed = within(wiki()).getByRole('list', { name: 'Children of DM-SHOP-CMD01' });
    expect(within(mixed).getByText('Command handler', { selector: 'small' })).toBeInTheDocument();
    expect(within(mixed).getByText('Endpoint', { selector: 'small' })).toBeInTheDocument();
    noListInFacts(/^Children/);

    // A group's members are titled by their kind, in the wiki only.
    await openApp('/DM-SHOP/interaction-design/flow');
    await screen.findByRole('heading', { level: 1, name: /^Flows/ });
    // The card's own title is "Flows (1)"; the members' section is titled by the kind.
    expect(within(wiki()).getByRole('heading', { level: 2, name: /^Flows\s*1$/ })).toHaveTextContent('Flows1');
    expect(within(wiki()).queryByRole('heading', { name: /^Members/ })).toBeNull();
    expect(within(wiki()).getByRole('list', { name: 'Flows of DM-SHOP/interaction-design/flow' })).toBeInTheDocument();

    // The title reads the workspace's kind label, so a renamed kind shows its own name.
    const w = workspace();
    w.schema.kinds.constraint.label = 'Rule';
    await openApp('/DM-VO01', { data: w });
    await screen.findByRole('heading', { level: 1, name: 'Quantity' });
    expect(within(wiki()).getByRole('heading', { level: 2, name: /^Rules/ })).toBeInTheDocument();
  });
});
