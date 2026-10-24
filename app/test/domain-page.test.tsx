import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { main, openApp, section } from './helpers';

const ids = (element: HTMLElement) => [...element.querySelectorAll('a.record-link code')].map((c) => c.textContent);

async function openShop() {
  await openApp('/specs/DM/DM-SHOP');
  await screen.findByRole('heading', { level: 1, name: 'Shopping' });
}

describe('domain page', () => {
  it('LA-BRW-T07 The domain page groups records by stage, with rules and requirements nested', async () => {
    await openShop();
    const [define, design] = within(main()).getAllByRole('heading', { level: 2, name: /^(Define|Design)$/ }).map((h) => h.parentElement as HTMLElement);
    expect(define).toHaveTextContent(/^Define/);
    expect(design).toHaveTextContent(/^Design/);

    // Define: aggregates with their rules nested, use cases with their requirements nested.
    const aggregates = section(/^Aggregates and domain rules/);
    const basket = within(aggregates).getByRole('link', { name: /^DM-SHOP-A1\s*Basket/ }).closest('li') as HTMLElement;
    expect(ids(basket.querySelector('ul.nested') as HTMLElement)).toEqual(['DM-SHOP-DR01']);
    const useCases = section(/^Use cases and requirements/);
    const add = within(useCases).getByRole('link', { name: /^DM-SHOP-UC01\s*Add/ }).closest('li') as HTMLElement;
    expect(ids(add.querySelector('ul.nested') as HTMLElement)).toEqual(['DM-SHOP-UC01-R01', 'DM-SHOP-UC01-R02']);
    expect(add).toHaveTextContent('Shopper');
    expect(define.contains(aggregates) && define.contains(useCases)).toBe(true);

    // Design: flows, views, endpoints, components and tests, in that order.
    const designSections = [...design.querySelectorAll('section')];
    expect(designSections.map((s) => s.querySelector('h2')?.firstChild?.textContent)).toEqual(['Flows', 'Views', 'Endpoints', 'Components', 'Tests']);
    expect(designSections.map((s) => ids(s))).toEqual([['DM-SHOP-F01'], ['DM-SHOP-V01'], ['DM-SHOP-E01'], ['DM-SHOP-C01'], ['DM-SHOP-T01']]);
    expect(designSections[2]).toHaveTextContent('POST · /basket/items');
    expect(designSections[3]).toHaveTextContent('service · src/basket.ts');
    expect(designSections[4]).toHaveTextContent('unit · test/basket.test.ts');
  });

  it('LA-BRW-T08 The search box filters records by ID or title as you type', async () => {
    await openShop();
    const user = userEvent.setup();
    const search = screen.getByLabelText('Filter records');

    await user.type(search, 'full basket');
    expect(ids(section(/^Use cases and requirements/))).toEqual(['DM-SHOP-UC01', 'DM-SHOP-UC01-R02']);
    expect(within(section(/^Aggregates and domain rules/)).getByText('Nothing matches.')).toBeInTheDocument();
    expect(within(section(/^Components/)).getByText('Nothing matches.')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'shop-c01');
    expect(ids(section(/^Components/))).toEqual(['DM-SHOP-C01']);
    expect(within(section(/^Tests/)).getByText('Nothing matches.')).toBeInTheDocument();

    await user.clear(search);
    expect(ids(section(/^Tests/))).toEqual(['DM-SHOP-T01']);
    expect(ids(section(/^Aggregates and domain rules/))).toEqual(['DM-SHOP-A1', 'DM-SHOP-DR01']);
  });

  it('LA-BRW-T09 The domain page lists its coverage gaps, each with the missing link, and its problems', async () => {
    await openShop();
    const coverage = section(/^Coverage/);
    const gaps = within(coverage).getAllByRole('listitem');
    expect(gaps.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/DM-SHOP-UC01-R02.*Requirement with nothing that proves it/),
      expect.stringMatching(/DM-SHOP-DR01.*Domain rule with nothing that proves it/),
    ]);
    // Gaps also show on the record's row.
    const row = within(section(/^Use cases and requirements/)).getByRole('link', { name: /DM-SHOP-UC01-R02/ }).closest('.record-row') as HTMLElement;
    expect(within(row).getByText('not proved')).toBeInTheDocument();

    const problems = within(section(/^Problems/)).getAllByRole('listitem');
    expect(problems.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^error.*DM-SHOP-T01.*does not exist.*test-file-missing$/),
      expect.stringMatching(/^warning.*DM-SHOP-DR01.*unproved$/),
      expect.stringMatching(/^warning.*DM-SHOP-UC01-R02.*unproved$/),
    ]);
    expect(main()).not.toHaveTextContent('DM-PAY-UC01-R01');
  });
});
