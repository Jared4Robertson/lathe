import './graph/setup';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { workspace } from './fixtures/workspace';
import { facts, openApp } from './helpers';

// A list of one kind is titled by that kind ("Invariant tests"); one of several kinds stays "Children"
// or "Members". The title, the list's accessible name and its search box all follow.

const wiki = () => screen.getByRole('region', { name: 'Wiki card' });
/** A record's facts, after its body, never repeat a list the body shows. */
const noListInFacts = (name: RegExp) => { expect(within(facts()).queryByRole('list', { name })).toBeNull(); expect(within(facts()).queryByRole('heading', { name })).toBeNull(); };

describe('list titles', () => {
  it('LA-V92-R09-T02 A list of children or members of one kind is titled by that kind, in the wiki card', async () => {
    // An invariant's tests: the record page says "Invariant tests"; its facts do not repeat them.
    await openApp('/DM-SHOP-INV01');
    await screen.findByRole('heading', { level: 1 });
    const tests = within(wiki()).getByRole('heading', { level: 2, name: /^Invariant tests/ });
    expect(tests).toHaveTextContent('Invariant tests1');
    expect(within(wiki()).queryByRole('heading', { name: /^Children/ })).toBeNull();
    expect(within(wiki()).getByRole('list', { name: 'Invariant tests of DM-SHOP-INV01' })).toBeInTheDocument();
    noListInFacts(/^Invariant tests/);

    // A use case's UC requirements, and the nested list under a row, are named by their kind too.
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    noListInFacts(/^UC requirements/);
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    fireEvent.click(within(wiki()).getByRole('button', { name: 'Expand DM-SHOP-CAP01' }));
    expect(within(wiki()).getByRole('list', { name: 'Use cases of DM-SHOP-CAP01' })).toBeInTheDocument();

    // A group's members are titled by their kind, in the wiki only.
    await openApp('/DM-SHOP/interaction-design/flow');
    await screen.findByRole('heading', { level: 1, name: /^Flows/ });
    // The card's own title is "Flows (1)"; the members' section is titled by the kind.
    expect(within(wiki()).getByRole('heading', { level: 2, name: /^Flows\s*1$/ })).toHaveTextContent('Flows1');
    expect(within(wiki()).queryByRole('heading', { name: /^Members/ })).toBeNull();
    expect(within(wiki()).getByRole('list', { name: 'Flows of DM-SHOP/interaction-design/flow' })).toBeInTheDocument();

    // The title reads the workspace's kind label, so a renamed kind shows its own name.
    const w = workspace();
    w.schema.kinds.invariant_test.label = 'Proof';
    await openApp('/DM-SHOP-INV01', { data: w });
    await screen.findByRole('heading', { level: 1 });
    expect(within(wiki()).getByRole('heading', { level: 2, name: /^Proofs/ })).toBeInTheDocument();
  });
});
