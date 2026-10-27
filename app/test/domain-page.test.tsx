import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { main, openApp, section } from './helpers';
import { workspace as demoWorkspace } from './fixtures/workspace';
import { addRows } from './fixtures/load';

const ids = (element: HTMLElement) => [...element.querySelectorAll('a.record-link code')].map((c) => c.textContent);

async function openShop() {
  await openApp('/DM-SHOP');
  await screen.findByRole('heading', { level: 1, name: 'Shopping' });
}

describe('domain page', () => {
  it('LA-EXP-T03 The domain page groups records by stage and folder, with rules and requirements nested', async () => {
    await openShop();
    const user = userEvent.setup();
    const [define, design] = within(main()).getAllByRole('heading', { level: 2, name: /^(Define|Design)$/ }).map((h) => h.parentElement as HTMLElement);
    expect(define).toHaveTextContent(/^Define/);
    expect(design).toHaveTextContent(/^Design/);
    const headings = (el: HTMLElement, level: string) => [...el.querySelectorAll(level)].map((h) => h.firstChild?.textContent);
    expect(headings(define, 'h3')).toEqual(['Domain model', 'Capabilities']);
    expect(headings(design, 'h3')).toEqual(['Interaction design', 'Technical specification', 'Test plan']);

    // Define: the domain model's aggregates with their rules folded under them, use cases with their requirements.
    const model = section(/^Domain model/);
    const basket = within(model).getByRole('link', { name: /^DM-SHOP-A1\s*Basket/ }).closest('li') as HTMLElement;
    expect(basket).toHaveTextContent('1 domain rule');
    expect(basket.querySelector('ul.nested')).toBeNull();
    await user.click(within(basket).getByRole('button', { name: 'Expand DM-SHOP-A1' }));
    expect(ids(basket.querySelector('ul.nested') as HTMLElement)).toEqual(['DM-SHOP-DR01']);
    const useCases = section(/^Capabilities/);
    const add = within(useCases).getByRole('link', { name: /^DM-SHOP-UC01\s*Add/ }).closest('li') as HTMLElement;
    expect(add).toHaveTextContent('2 UC requirements');
    await user.click(within(add).getByRole('button', { name: 'Expand DM-SHOP-UC01' }));
    expect(ids(add.querySelector('ul.nested') as HTMLElement)).toEqual(['DM-SHOP-UC01-R01', 'DM-SHOP-UC01-R02']);
    expect(add).toHaveTextContent('Shopper');
    expect(define.contains(model) && define.contains(useCases)).toBe(true);

    // Design: interaction design holds flows, views and endpoints, each under its own heading, in that order.
    const interaction = section(/^Interaction design/);
    expect(headings(interaction, 'h4')).toEqual(['Flows', 'Views', 'Endpoints']);
    expect(['Flows', 'Views', 'Endpoints'].map((name) => ids(section(new RegExp(`^${name}`))))).toEqual([['DM-SHOP-F01'], ['DM-SHOP-V01'], ['DM-SHOP-E01']]);
    expect(section(/^Endpoints/)).toHaveTextContent('POST · /basket/items');
    // A folder of one kind lists its records directly.
    expect(ids(section(/^Technical specification/))).toEqual(['DM-SHOP-C01']);
    expect(section(/^Technical specification/)).toHaveTextContent('service · src/basket.ts');
    expect(section(/^Technical specification/).querySelector('h4')).toBeNull();
    expect(ids(section(/^Test plan/))).toEqual(['DM-SHOP-T01']);
    expect(section(/^Test plan/)).toHaveTextContent('unit · test/basket.test.ts');
  });

  it('LA-EXP-T04 The search box filters records by ID or title as you type', async () => {
    await openShop();
    const user = userEvent.setup();
    const search = screen.getByLabelText('Filter records');

    await user.type(search, 'full basket');
    // A match inside a folded use case opens it, just for the match.
    expect(ids(section(/^Capabilities/))).toEqual(['DM-SHOP-UC01', 'DM-SHOP-UC01-R02']);
    expect(within(section(/^Domain model/)).getByText('Nothing matches.')).toBeInTheDocument();
    expect(within(section(/^Technical specification/)).getByText('Nothing matches.')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'shop-c01');
    expect(ids(section(/^Technical specification/))).toEqual(['DM-SHOP-C01']);
    expect(within(section(/^Test plan/)).getByText('Nothing matches.')).toBeInTheDocument();

    await user.clear(search);
    expect(ids(section(/^Test plan/))).toEqual(['DM-SHOP-T01']);
    expect(ids(section(/^Domain model/))).toEqual(['DM-SHOP-A1']);
    expect(ids(section(/^Capabilities/))).toEqual(['DM-SHOP-UC01']);
  });

  it('LA-EXP-T05 The domain page lists its coverage gaps, each with the missing link, and its problems', async () => {
    await openShop();
    const coverage = section(/^Coverage/);
    const gaps = within(coverage).getAllByRole('listitem');
    expect(gaps.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/DM-SHOP-UC01-R02.*UC requirement with nothing that proves it/),
      expect.stringMatching(/DM-SHOP-DR01.*Domain rule with nothing that proves it/),
    ]);
    // Gaps also show on the record's row.
    await userEvent.setup().click(within(section(/^Capabilities/)).getByRole('button', { name: 'Expand all' }));
    const row = within(section(/^Capabilities/)).getByRole('link', { name: /DM-SHOP-UC01-R02/ }).closest('.record-row') as HTMLElement;
    expect(within(row).getByText('not proved')).toBeInTheDocument();

    const problems = within(section(/^Problems in this domain/)).getAllByRole('listitem');
    expect(problems.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^error.*DM-SHOP-T01.*does not exist.*test-file-missing$/),
      expect.stringMatching(/^warning.*DM-SHOP-DR01.*unproved$/),
      expect.stringMatching(/^warning.*DM-SHOP-UC01-R02.*unproved$/),
    ]);
    expect(main()).not.toHaveTextContent('DM-PAY-UC01-R01');
  });

  it('lists only capabilities in Capabilities when the domain keeps its use cases under capabilities', async () => {
    const w = demoWorkspace();
    addRows(w, 'capability', { id: 'DM-SHOP-CAP01', title: 'Buying', domain_id: 'DM-SHOP', position: 1 });
    for (const r of w.tables.use_case) if (r.domain_id === 'DM-SHOP') r.capability_id = 'DM-SHOP-CAP01';
    await openApp('/DM-SHOP', { data: w });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(ids(section(/^Capabilities/))).toEqual(['DM-SHOP-CAP01']);
    expect(section(/^Capabilities/).querySelector('h4')).toBeNull();
    expect(screen.queryByRole('heading', { name: /outside any capability/ })).toBeNull();
  });
});
