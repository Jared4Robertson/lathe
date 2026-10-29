import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { VIEW_COMMANDS } from '../../lathe/src/authoring/view/commands/index';
import type { ViewCommands } from '../src/authoring/view/commands';
import type { SpecData, WriteAnswer } from '../../lathe/src/server/contract';
import { addRows, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// The View page and its editor (LA-AUT-A12, LA-V150): a view and its requirements and tests are read through the
// aggregate's own query, and changed only through the aggregate's own commands, one per change, each refusal shown
// with its reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

/** The component-test workspace with DM-V01's requirement proved by a test, and a second requirement under a group. */
function withRequirements(): SpecData {
  const data = addRows(workspace(), 'view_test', { id: 'DM-V01-R01-T01', title: 'The total shows', view_requirement_id: 'DM-V01-R01', level: 'browser', state: 'automated', file: 'test/basket.spec.ts', when: 'Opens the basket.', then: 'Expects the total.' });
  return addRows(data, 'view_requirement', { id: 'DM-V01-R02', title: 'Shows the shipping', view_id: 'DM-V01', statement: 'The basket page MUST show the shipping cost.', group_name: 'Costs' });
}

describe('LA-V150-R01-T01 a view\'s records are read through the View aggregate\'s own query, never a generic record read', () => {
  it('reads GET /api/view/get-view for a requirement, and shows its statement', async () => {
    const { requests } = await openApp('/DM-V01-R01', { data: withRequirements() });
    expect(await within(main()).findByText('The basket page MUST show the total.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/view/get-view?id=DM-V01-R01');
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof ViewCommands)[] = [
      '/api/view/add-view', '/api/view/add-view-requirement', '/api/view/add-view-test',
      '/api/view/change-view', '/api/view/change-view-requirement', '/api/view/change-view-test',
      '/api/view/remove-view', '/api/view/remove-view-requirement', '/api/view/remove-view-test',
    ];
    expect([...routes].sort()).toEqual(VIEW_COMMANDS.map((c) => c.route).sort());
  });
});

describe('LA-V150-R04-T01 a view\'s page lists its requirements under their groups, each with the tests that prove it', () => {
  it('shows the route and the requirements table: the ungrouped first, then each group under its heading', async () => {
    await openApp('/DM-V01', { data: withRequirements() });
    const table = await within(main()).findByRole('table', { name: /The requirements of DM-V01/ });
    expect(within(screen.getByRole('complementary', { name: 'Facts' })).getByText('/basket')).toBeInTheDocument();
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Requirement', 'Proved by']);
    const groups = table.querySelectorAll('tbody');
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('DM-V01-R01');
    expect(groups[0]).toHaveTextContent('DM-V01-R01-T01');
    expect(groups[1].getAttribute('data-group')).toBe('Costs');
    expect(within(groups[1] as HTMLElement).getByText('Nothing yet')).toBeInTheDocument();
  });
});

describe('LA-V150-R02-T01 the View editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a view requirement with only what changed; an emptied group is cleared with null; no Move', async () => {
    const user = userEvent.setup();
    const changed = () => setRow(withRequirements(), 'view_requirement', 'DM-V01-R02', { group_name: null });
    const { commands, writes } = await openApp('/DM-V01-R02', { data: withRequirements(), command: () => ({ answer: ok, data: changed() }) });
    const actions = await toolbar('DM-V01-R02');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add view test', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-V01-R02' });
    await user.clear(within(form).getByRole('textbox', { name: /^group name/ }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/view/change-view-requirement', input: { id: 'DM-V01-R02', group_name: null } }]));
    expect(writes).toEqual([]);
  });

  it('adds a requirement under the view with the next free ID, through Add a view requirement', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-V01', { data: withRequirements(), command: () => ({ answer: ok }) });
    await user.click(within(await toolbar('DM-V01')).getByRole('button', { name: 'Add view requirement' }));
    const form = screen.getByRole('form', { name: 'Add a view requirement' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-V01-R03'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Shows the tax');
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), 'The basket page MUST show the tax.');
    await user.click(within(form).getByRole('button', { name: 'Add view requirement' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/view/add-view-requirement', input: { view_id: 'DM-V01', id: 'DM-V01-R03', title: 'Shows the tax', statement: 'The basket page MUST show the tax.' } }]));
  });

  it('adds a view from its product\'s page through the aggregate\'s own Add, with the next free ID and no parent', async () => {
    const user = userEvent.setup();
    const { commands, writes } = await openApp('/DM', { command: () => ({ answer: ok }) });
    const actions = await toolbar('DM');
    await user.click(within(actions).getByRole('button', { name: 'Add…' }));
    await user.click(within(within(actions).getByRole('group', { name: 'Kinds to add under DM' })).getByRole('button', { name: 'View' }));
    const form = screen.getByRole('form', { name: 'Add a view' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-V02'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Checkout');
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), 'Shows the order before the shopper pays.');
    await user.click(within(form).getByRole('button', { name: 'Add view' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/view/add-view', input: { id: 'DM-V02', title: 'Checkout', description: 'Shows the order before the shopper pays.' } }]));
    expect(writes).toEqual([]);
  });
});

describe('LA-V150-R03-T01 a refused View command shows every reason, keeps what was entered, and changes nothing', () => {
  it('Remove sends Remove a view and shows the refusal naming what still happens in it', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'view', key: 'DM-V01', message: 'View DM-V01 is referenced, so it stays: flow step DM-SHOP-UC01-FL01-S01 happens in it' }] };
    const { commands } = await openApp('/DM-V01', { data: withRequirements(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('DM-V01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove DM-V01?' });
    expect(within(panel).getByRole('list', { name: 'What goes with DM-V01' })).toHaveTextContent('DM-V01-R01-T01');
    await user.click(within(panel).getByRole('button', { name: 'Remove DM-V01' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The removal was refused. Nothing was changed.');
    expect(alert).toHaveTextContent('flow step DM-SHOP-UC01-FL01-S01 happens in it');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/view/remove-view', input: { id: 'DM-V01' } }]);
    expect(window.location.pathname).toBe('/DM-V01');
  });
});
