import type { ServedData } from './read-view';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// The Business outcome page and its editor (LA-PRD-A16): an outcome is read through the aggregate's own query, and
// changed only through the aggregate's own commands, one per change, each refusal shown with its reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.getByRole('toolbar', { name: `Change ${id}` });

/** The demo shop with two outcomes: the first served by the Basket aggregate and measured by a test, the second measured outside the code. */
function withOutcomes(): ServedData {
  const w = workspace();
  addRows(
    w,
    'business_outcome',
    { id: 'DM-BO01', title: 'More baskets checked out', product_id: 'DM', statement: 'More of the baskets shoppers fill are checked out.', measure: 'Baskets checked out over baskets started, each week.', target: 'Two in three within a quarter.' },
    { id: 'DM-BO02', title: 'Fewer refunds', product_id: 'DM', statement: 'Shoppers ask for fewer refunds.', measure: 'Refunds per hundred orders, each month.', target: 'Under two within a year.' },
  );
  addRows(w, 'serves', { source_id: 'DM-SHOP-A1', target_id: 'DM-BO01' });
  addRows(w, 'measured_by', { source_id: 'DM-BO01', target_id: 'DM-SHOP-UC01-R01-T01' });
  setRow(w, 'business_outcome', 'DM-BO02', { measured_outside: 'Counted from the payment provider\'s refund report each month.' });
  return w;
}

describe('LA-V110-R01-T01 an outcome\'s page reads the outcome through its own query, never a generic record read', () => {
  it('reads GET /api/business-outcome/get-business-outcome and shows its statement, measure and target', async () => {
    const { requests } = await openApp('/DM-BO01', { data: withOutcomes() });
    expect(await within(main()).findByText('More of the baskets shoppers fill are checked out.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/business-outcome/get-business-outcome?id=DM-BO01');
    expect(within(main()).getByRole('heading', { name: 'Measure' }).closest('section')).toHaveTextContent('Baskets checked out over baskets started, each week.');
    expect(within(main()).getByRole('heading', { name: 'Target' }).closest('section')).toHaveTextContent('Two in three within a quarter.');
  });
});

describe('LA-V110-R02-T01 the Business outcome editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a business outcome with only what changed, and offers no Move', async () => {
    const user = userEvent.setup();
    const changed = () => setRow(withOutcomes(), 'business_outcome', 'DM-BO01', { target: 'Three in four within a quarter.' });
    const { commands } = await openApp('/DM-BO01', { data: withOutcomes(), command: () => ({ answer: ok, data: changed() }) });
    await within(main()).findByText('More of the baskets shoppers fill are checked out.');
    expect(within(toolbar('DM-BO01')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Remove']);
    await user.click(within(toolbar('DM-BO01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-BO01' });
    const target = within(form).getByRole('textbox', { name: /^target/ });
    await user.clear(target);
    await user.type(target, 'Three in four within a quarter.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/business-outcome/change-business-outcome', input: { id: 'DM-BO01', target: 'Three in four within a quarter.' } }]));
    expect(await within(main()).findByText('Three in four within a quarter.')).toBeInTheDocument();
  });

  it('adds an outcome from its product\'s page through the aggregate\'s own Add, with the next free ID', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM', { data: withOutcomes(), command: () => ({ answer: ok }) });
    await screen.findByRole('toolbar', { name: 'Change DM' });
    await user.click(within(toolbar('DM')).getByRole('button', { name: 'Add…' }));
    await user.click(within(toolbar('DM')).getByRole('button', { name: 'Business outcome' }));
    const form = screen.getByRole('form', { name: 'Add a business outcome' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-BO03'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Faster checkout');
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), 'Shoppers check out faster.');
    await user.type(within(form).getByRole('textbox', { name: /^measure$/ }), 'Median checkout time.');
    await user.type(within(form).getByRole('textbox', { name: /^target/ }), 'Under a minute.');
    await user.click(within(form).getByRole('button', { name: 'Add business outcome' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/business-outcome/add-business-outcome', input: { product_id: 'DM', id: 'DM-BO03', title: 'Faster checkout', statement: 'Shoppers check out faster.', measure: 'Median checkout time.', target: 'Under a minute.' } }]));
  });
});

describe('LA-V110-R03-T01 a refused Business outcome command shows every reason, keeps what was entered, and changes nothing', () => {
  it('Remove sends Remove a business outcome and shows the refusal naming what still references it', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'business_outcome', key: 'DM-BO01', message: 'Business outcome DM-BO01 is referenced, so it stays: aggregate DM-SHOP-A1 serves it' }] };
    const { commands } = await openApp('/DM-BO01', { data: withOutcomes(), command: () => ({ answer: refusal }) });
    await within(main()).findByText('More of the baskets shoppers fill are checked out.');
    await user.click(within(toolbar('DM-BO01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove DM-BO01?' });
    await user.click(within(panel).getByRole('button', { name: 'Remove DM-BO01' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The removal was refused. Nothing was changed.');
    expect(alert).toHaveTextContent('aggregate DM-SHOP-A1 serves it');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/business-outcome/remove-business-outcome', input: { id: 'DM-BO01' } }]);
    expect(window.location.pathname).toBe('/DM-BO01');
  });
});

describe('LA-V110-R04-T01 an outcome shows the tests that measure it, and how it is measured outside the code', () => {
  it('lists Measured by in its Traceability, and its measure outside the code when it says so', async () => {
    await openApp('/DM-BO01', { data: withOutcomes() });
    const trace = (await within(main()).findByRole('heading', { level: 2, name: 'Traceability' })).closest('section') as HTMLElement;
    expect(within(trace).getByRole('heading', { level: 3, name: /^Measured by/ })).toBeInTheDocument();
    expect(within(trace).getByRole('link', { name: /DM-SHOP-UC01-R01-T01/ })).toBeInTheDocument();
    await openApp('/DM-BO02', { data: withOutcomes() });
    expect((await within(main()).findByRole('heading', { name: 'Measured outside the code' })).closest('section')).toHaveTextContent("Counted from the payment provider's refund report each month.");
    expect(within(main()).queryByRole('heading', { level: 3, name: /^Measured by/ })).toBeNull();
  });
});
