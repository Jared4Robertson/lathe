import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { modelWorkspace } from './fixtures/model';
import { addRows, removeRows } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp, section } from './helpers';

// A flow's steps on its record page, under its All interfaces tab (the flow as written): a table per path (main
// first), each in position order, folded one level. Each step shows what it invokes, the UC requirements it fulfills
// and the integrations it exchanges with.

const steps = () => section(/^Steps/);
const tables = () => within(steps()).getAllByRole('table');
const bodyRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1).filter((r) => r.classList.contains('flow-step'));
const cells = (row: HTMLElement) => [...row.querySelectorAll('th, td')] as HTMLElement[];
const linkIds = (el: HTMLElement) => [...el.querySelectorAll('a')].map((a) => a.textContent);

describe('flow steps on a flow page', () => {
  const proveLaV92R23T01 = async () => {
    await openApp('/DM-SHOP-UC01-FL');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(steps().querySelector('h2')).toHaveTextContent('Steps3');
    const [mainPath] = tables();
    expect(within(mainPath).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Step', 'What happens', 'Invokes', 'Fulfills', 'Exchanges with']);
    const rows = bodyRows(mainPath);
    expect(rows.map((r) => r.getAttribute('data-step'))).toEqual(['DM-SHOP-UC01-FL-S01', 'DM-SHOP-UC01-FL-S02']);
    const [step, what, invokes, fulfills, exchanges] = cells(rows[0]);
    expect(step).toHaveTextContent('1DM-SHOP-UC01-FL-S01');
    expect(what).toHaveTextContent('Shopper adds the item');
    expect(linkIds(invokes)).toEqual(['DM-SHOP-CMD01']);
    expect(linkIds(fulfills)).toEqual(['DM-SHOP-UC01-R01']);
    expect(within(fulfills).getByRole('link', { name: 'DM-SHOP-UC01-R01' })).toHaveAttribute('href', '/DM-SHOP-UC01-R01');
    expect(exchanges).toHaveTextContent('None');
    // The second step invokes a query.
    expect(linkIds(cells(rows[1])[2])).toEqual(['DM-SHOP-QRY01']);

    // A step exchanging with an integration.
    await openApp('/P-D-UC01-FL', { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const s02 = bodyRows(tables()[0])[1];
    expect(linkIds(cells(s02)[4])).toEqual(['P-INT01']);
  };
  it('LA-V101-R06-T01 A flow page shows its steps in order as a table: step, what happens, invokes, fulfills, exchanges with', proveLaV92R23T01);
  it('LA-V101-R04-T01 A flow page shows its steps in order as a table', proveLaV92R23T01);

  it('LA-V101-R07-T01 The titles of what a step links to are folded under its row', async () => {
    await openApp('/DM-SHOP-UC01-FL');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const user = userEvent.setup();
    const [mainPath] = tables();
    expect(within(mainPath).queryByText(/The basket shows the new item/)).toBeNull();
    const toggle = within(mainPath).getByRole('button', { name: 'Expand DM-SHOP-UC01-FL-S01' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    const details = within(mainPath).getByRole('region', { name: 'Details of DM-SHOP-UC01-FL-S01' });
    expect(within(details).getByRole('link', { name: /DM-SHOP-UC01-R01.*The basket shows the new item/ })).toBeInTheDocument();
    expect(details).toHaveTextContent('UC requirement');
    expect(within(details).getByRole('link', { name: /DM-SHOP-CMD01.*Add item/ })).toBeInTheDocument();
    await user.click(within(mainPath).getByRole('button', { name: 'Collapse DM-SHOP-UC01-FL-S01' }));
    expect(within(mainPath).queryByRole('region')).toBeNull();

    // Expand all opens every row of every path, Collapse all closes them.
    await user.click(within(steps()).getByRole('button', { name: 'Expand all' }));
    expect(within(steps()).getAllByRole('region', { name: /^Details of/ })).toHaveLength(3);
    await user.click(within(steps()).getByRole('button', { name: 'Collapse all' }));
    expect(within(steps()).queryAllByRole('region', { name: /^Details of/ })).toHaveLength(0);
  });

  it('LA-V101-R08-T01 A step row carries its problems, and a flow without steps shows no steps table', async () => {
    const data = workspace();
    data.problems.push({ severity: 'warning', check: 'not-proved', record: 'DM-SHOP-UC01-FL-S02', message: 'A step with a problem.' });
    await openApp('/DM-SHOP-UC01-FL', { data });
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(cells(bodyRows(tables()[0])[1])[1]).toHaveTextContent('1 warning');
    removeRows(data, 'flow_step', (s) => s.flow_id === 'DM-PAY-UC01-FL');
    await openApp('/DM-PAY-UC01-FL', { data });
    await screen.findByRole('heading', { level: 1, name: 'Pay by card' });
    expect(within(main()).queryByRole('heading', { name: /^Steps/ })).toBeNull();
  });

  it('LA-V101-R04-T02 Steps are ordered by their position as a number, then by ID', async () => {
    const data = workspace();
    addRows(data, 'flow_step', { id: 'DM-SHOP-UC01-FL-S04', title: 'The basket shows a total', flow_id: 'DM-SHOP-UC01-FL', path: 'main', position: 10 });
    await openApp('/DM-SHOP-UC01-FL', { data });
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(bodyRows(tables()[0]).map((r) => r.getAttribute('data-step'))).toEqual(['DM-SHOP-UC01-FL-S01', 'DM-SHOP-UC01-FL-S02', 'DM-SHOP-UC01-FL-S04']);
  });

  it('LA-V101-R09-T01 A flow with several paths shows a table per path, the main path first, then the others by name', async () => {
    const data = workspace();
    addRows(data, 'flow_step', { id: 'DM-SHOP-UC01-FL-S04', title: 'A saved basket opens', flow_id: 'DM-SHOP-UC01-FL', path: 'api', position: 1 });
    await openApp('/DM-SHOP-UC01-FL', { data });
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect([...steps().querySelectorAll('h3')].map((h) => h.firstChild?.textContent)).toEqual(['Main path', 'Api path', 'Refused path']);
    expect(tables().map((t) => bodyRows(t).map((tr) => tr.getAttribute('data-step')))).toEqual([
      ['DM-SHOP-UC01-FL-S01', 'DM-SHOP-UC01-FL-S02'], ['DM-SHOP-UC01-FL-S04'], ['DM-SHOP-UC01-FL-S03'],
    ]);
    // The flow's steps are its table, not repeated as its children.
    expect(within(main()).queryByRole('heading', { name: /^Flow steps/ })).toBeNull();
  });
});
