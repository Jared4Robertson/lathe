import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { stepsOf } from '../src/specs/FlowSteps';
import { indexWorkspace } from '../src/specs/data';
import { stepsWorkspace } from './fixtures/flow-steps';
import { main, openApp, section } from './helpers';

// A flow's steps on its record page (FORMAT.md section 13): a table in order, folded one level.

const table = () => within(section(/^Steps/)).getByRole('table');
const bodyRows = () => within(table()).getAllByRole('row').slice(1).filter((r) => r.classList.contains('flow-step'));
const cells = (row: HTMLElement) => [...row.querySelectorAll('th, td')] as HTMLElement[];
const linkIds = (el: HTMLElement) => [...el.querySelectorAll('a')].map((a) => a.textContent);

describe('flow steps on a flow page', () => {
  it('LA-EXP-T63 A flow page shows its steps in order as a table: step, what happens, uses, carries out', async () => {
    await openApp('/DM-SHOP-F01', { workspace: stepsWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Fill a basket' });
    expect(section(/^Steps/).querySelector('h2')).toHaveTextContent('Steps3');
    expect(within(table()).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Step', 'What happens', 'Uses', 'Carries out']);
    // In order by number: 1, 2, 10, whatever the IDs.
    const rows = bodyRows();
    expect(rows.map((r) => r.getAttribute('data-step'))).toEqual(['DM-SHOP-F01-S02', 'DM-SHOP-F01-S03', 'DM-SHOP-F01-S01']);
    const [step, what, uses, fulfills] = cells(rows[1]);
    expect(step).toHaveTextContent('2DM-SHOP-F01-S03');
    expect(what).toHaveTextContent('The page adds it to the basket');
    expect(linkIds(uses)).toEqual(['DM-SHOP-V01', 'DM-SHOP-E01']);
    expect(linkIds(fulfills)).toEqual(['DM-SHOP-UC01-R02', 'DM-SHOP-DR01']);
    expect(within(fulfills).getByRole('link', { name: 'DM-SHOP-DR01' })).toHaveAttribute('href', '/DM-SHOP-DR01');
    expect(cells(rows[0])[3]).toHaveTextContent('None');
  });

  it("LA-EXP-T64 Each step's body and the titles of what it uses and fulfills are folded under its row", async () => {
    await openApp('/DM-SHOP-F01', { workspace: stepsWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Fill a basket' });
    const user = userEvent.setup();
    expect(within(table()).queryByText('new item')).toBeNull();
    const toggle = within(table()).getByRole('button', { name: 'Expand DM-SHOP-F01-S01' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    const details = within(table()).getByRole('region', { name: 'Details of DM-SHOP-F01-S01' });
    expect(within(details).getByText('new item').tagName).toBe('STRONG');
    expect(within(details).getByRole('link', { name: /DM-SHOP-UC01-R01.*The basket shows the new item/ })).toBeInTheDocument();
    expect(details).toHaveTextContent('UC requirement');
    await user.click(within(table()).getByRole('button', { name: 'Collapse DM-SHOP-F01-S01' }));
    expect(within(table()).queryByRole('region')).toBeNull();

    // Expand all opens every row, Collapse all closes them.
    await user.click(within(section(/^Steps/)).getByRole('button', { name: 'Expand all' }));
    expect(within(table()).getAllByRole('region')).toHaveLength(3);
    await user.click(within(section(/^Steps/)).getByRole('button', { name: 'Collapse all' }));
    expect(within(table()).queryAllByRole('region')).toHaveLength(0);
  });

  it("LA-EXP-T65 A step row carries its problems, and a flow without steps shows no steps table", async () => {
    await openApp('/DM-SHOP-F01', { workspace: stepsWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Fill a basket' });
    expect(cells(bodyRows()[1])[1]).toHaveTextContent('1 warning');
    await openApp('/DM-SHOP-F01');
    await screen.findByRole('heading', { level: 1, name: 'Fill a basket' });
    expect(within(main()).queryByRole('heading', { name: /^Steps/ })).toBeNull();
  });

  it('LA-EXP-T66 Steps are ordered by their order as a number; a step without a whole-number order goes last', () => {
    const w = stepsWorkspace();
    w.records.find((r) => r.id === 'DM-SHOP-F01-S02')!.fields.order = 'first';
    expect(stepsOf(indexWorkspace(w), 'DM-SHOP-F01').map((s) => s.id)).toEqual(['DM-SHOP-F01-S03', 'DM-SHOP-F01-S01', 'DM-SHOP-F01-S02']);
  });
});
