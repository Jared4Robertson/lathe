import type { ServedData } from './read-view';
import { addChoices, chooseAdd } from './add-menu';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp, section } from './helpers';

// The Command page and its editor (LA-AUT-A8, LA-V132): a command and every record in it are read through the
// aggregate's own query, and changed only through the aggregate's own commands, one per change, each refusal shown with
// its reasons; a command lists its handler, its policies and the endpoints that expose it, and a policy the event it
// hears.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

/** The demo shop with a policy that hears the basket's event. */
function withPolicy(): ServedData {
  const w = workspace();
  addRows(w, 'policy', { id: 'DM-SHOP-PO01', title: 'Add again when an item is added', command_id: 'DM-SHOP-CMD01', statement: 'Whenever an item is added, it is added again.' });
  addRows(w, 'hears', { source_id: 'DM-SHOP-PO01', target_id: 'DM-SHOP-EV01' });
  return w;
}

describe('LA-V132-R04-T01 a command\'s records are read through the Command aggregate\'s own query, never a generic record read', () => {
  it('reads GET /api/command/get-command for a policy, and shows its statement', async () => {
    const { requests } = await openApp('/DM-SHOP-PO01', { data: withPolicy() });
    expect(await within(main()).findByText('Whenever an item is added, it is added again.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/command/get-command?id=DM-SHOP-PO01');
    expect(section(/^Policy test/)).toHaveTextContent('No test proves it yet.');
  });
});

describe('LA-V132-R02-T01 the Command editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a command with the events it raises as one list, and offers no Move', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP-CMD01', { data: withPolicy(), command: () => ({ answer: ok }) });
    const actions = await toolbar('DM-SHOP-CMD01');
    // It has its handler, so a policy can be added under it, and an endpoint through the Endpoint aggregate's own Add.
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add…', 'Remove']);
    expect(await addChoices(user, actions)).toEqual(['Policy', 'Endpoint']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-CMD01' });
    await user.click(within(form).getByRole('button', { name: 'Remove DM-SHOP-EV01 from Raises' }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/command/change-command', input: { id: 'DM-SHOP-CMD01', raises: [] } }]));
  });

  it('adds a policy that hears an event, with the next free ID in its domain', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP-CMD01', { data: withPolicy(), command: () => ({ answer: ok }) });
    await chooseAdd(user, await toolbar('DM-SHOP-CMD01'), 'Policy');
    const form = screen.getByRole('form', { name: 'Add a policy' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-SHOP-PO02'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Add when paid');
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), 'Whenever a payment is taken, an item is added.');
    await user.selectOptions(within(form).getByRole('combobox', { name: /^Hears/ }), 'DM-PAY-EV01');
    await user.click(within(form).getByRole('button', { name: 'Add policy' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/command/add-policy', input: { command_id: 'DM-SHOP-CMD01', id: 'DM-SHOP-PO02', title: 'Add when paid', statement: 'Whenever a payment is taken, an item is added.', hears: 'DM-PAY-EV01' } }]));
  });

  it('adds a command from its entity\'s page through the Command aggregate\'s own Add', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP-EN01', { data: withPolicy(), command: () => ({ answer: ok }) });
    const actions = await toolbar('DM-SHOP-EN01');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add…', 'Remove']);
    expect(await addChoices(user, actions)).toEqual(['Data model', 'Command', 'Table']);
    await chooseAdd(user, actions, 'Command');
    const form = screen.getByRole('form', { name: 'Add a command' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-SHOP-CMD02'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Empty the basket');
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), 'Takes every item out.');
    await user.click(within(form).getByRole('button', { name: 'Add command' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/command/add-command', input: { entity_id: 'DM-SHOP-EN01', id: 'DM-SHOP-CMD02', title: 'Empty the basket', description: 'Takes every item out.' } }]));
  });
});

describe('LA-V132-R03-T01 a refused Command command shows every reason, keeps what was entered, and changes nothing', () => {
  it('Remove sends Remove a command and shows the refusal naming what still references it', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'command', key: 'DM-SHOP-CMD01', message: 'Command DM-SHOP-CMD01 is referenced, so it stays: endpoint DM-SHOP-EP01 sits under it' }] };
    const { commands } = await openApp('/DM-SHOP-CMD01', { data: withPolicy(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('DM-SHOP-CMD01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove DM-SHOP-CMD01?' });
    expect(within(panel).getByRole('list', { name: 'What goes with DM-SHOP-CMD01' })).toHaveTextContent('DM-SHOP-PO01');
    await user.click(within(panel).getByRole('button', { name: 'Remove DM-SHOP-CMD01' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The removal was refused. Nothing was changed.');
    expect(alert).toHaveTextContent('endpoint DM-SHOP-EP01 sits under it');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/command/remove-command', input: { id: 'DM-SHOP-CMD01' } }]);
    expect(window.location.pathname).toBe('/DM-SHOP-CMD01');
  });
});

describe('LA-V132-R04-T01 a command lists its handler, its policies and the endpoints that expose it, each with its method and route', () => {
  it('shows each in its own section', async () => {
    await openApp('/DM-SHOP-CMD01', { data: withPolicy() });
    await screen.findByRole('heading', { level: 1, name: 'Add item' });
    const endpoints = await waitFor(() => section(/^Endpoints/));
    const row = within(endpoints).getByRole('link', { name: /DM-SHOP-EP01/ }).closest('li')!;
    expect(row.textContent).toContain('POST /basket/items');
    expect(within(section(/^Command handler/)).getByRole('link', { name: /DM-SHOP-CMD01-H/ })).toBeInTheDocument();
    expect(within(section(/^Policies/)).getByRole('link', { name: /DM-SHOP-PO01/ })).toBeInTheDocument();
  });
});

describe('LA-V132-R05-T01 a policy lists the event it hears under "Hears", in the relation\'s own words', () => {
  it('shows Hears in its Traceability', async () => {
    await openApp('/DM-SHOP-PO01', { data: withPolicy() });
    const trace = (await within(main()).findByRole('heading', { level: 2, name: 'Traceability' })).closest('section') as HTMLElement;
    expect(within(trace).getByRole('heading', { level: 3, name: /^Hears/ })).toBeInTheDocument();
    expect(within(trace).getByRole('link', { name: /DM-SHOP-EV01/ })).toBeInTheDocument();
  });
});
