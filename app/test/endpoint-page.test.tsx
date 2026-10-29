import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ENDPOINT_COMMANDS } from '../../lathe/src/authoring/endpoint/commands/index';
import type { EndpointCommands } from '../src/authoring/endpoint/commands';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { modelWorkspace } from './fixtures/model';
import { main, openApp, section } from './helpers';

// The Endpoint page and its editor (LA-AUT-A13, LA-V152): an endpoint and its API requirements, handler and tests are
// read through the aggregate's own query, and changed only through the aggregate's own commands, one per change, Move
// for the endpoint alone, each refusal shown with its reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

describe('LA-V152-R01-T01 an endpoint\'s records are read through the Endpoint aggregate\'s own query, never a generic record read', () => {
  it('reads GET /api/endpoint/get-endpoint for an API requirement, and shows its statement', async () => {
    const { requests } = await openApp('/P-D-EP01-R01', { data: modelWorkspace() });
    expect(await within(main()).findByText('It MUST answer 201 with the loan.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/endpoint/get-endpoint?id=P-D-EP01-R01');
  });

  it('shows an endpoint\'s handler from the read, and the handler\'s description', async () => {
    await openApp('/P-D-EP01', { data: modelWorkspace() });
    const handler = await screen.findByRole('list', { name: 'The handler of P-D-EP01' });
    expect(within(handler).getByRole('link', { name: /P-D-EP01-H/ })).toHaveAttribute('href', '/P-D-EP01-H');
    await openApp('/P-D-EP01-H', { data: modelWorkspace() });
    expect(await within(main()).findByText("The fixture's endpoint handler postLoan.")).toBeInTheDocument();
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof EndpointCommands)[] = [
      '/api/endpoint/add-endpoint', '/api/endpoint/change-endpoint', '/api/endpoint/move-endpoint', '/api/endpoint/remove-endpoint',
      '/api/endpoint/add-api-requirement', '/api/endpoint/change-api-requirement', '/api/endpoint/remove-api-requirement',
      '/api/endpoint/add-endpoint-handler', '/api/endpoint/change-endpoint-handler', '/api/endpoint/remove-endpoint-handler',
      '/api/endpoint/add-endpoint-test', '/api/endpoint/change-endpoint-test', '/api/endpoint/remove-endpoint-test',
    ];
    expect([...routes].sort()).toEqual(ENDPOINT_COMMANDS.map((c) => c.route).sort());
  });
});

describe('LA-V152-R02-T01 the Endpoint editor writes only through the aggregate\'s own commands, one per change, Move for the endpoint alone', () => {
  it('Edit sends Change an API requirement with only what changed; an API requirement has no Move', async () => {
    const user = userEvent.setup();
    const { commands, writes } = await openApp('/P-D-EP01-R01', { data: modelWorkspace(), command: () => ({ answer: ok }) });
    const actions = await toolbar('P-D-EP01-R01');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add endpoint test', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-D-EP01-R01' });
    await user.type(within(form).getByRole('textbox', { name: /^group name/ }), 'Answers');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/endpoint/change-api-requirement', input: { id: 'P-D-EP01-R01', group_name: 'Answers' } }]));
    expect(writes).toEqual([]);
  });

  it('Move sends Move an endpoint to the query of its domain it now exposes', async () => {
    const user = userEvent.setup();
    const { commands, writes } = await openApp('/P-D-EP01', { data: modelWorkspace(), command: () => ({ answer: ok }) });
    const actions = await toolbar('P-D-EP01');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add API requirement', 'Move', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Move' }));
    const form = screen.getByRole('form', { name: 'Move P-D-EP01' });
    const exposes = within(form).getByRole('combobox', { name: /^Exposes/ });
    expect(exposes).toHaveValue('P-D-CMD01');
    await user.selectOptions(exposes, 'P-D-QRY01');
    await user.click(within(form).getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/endpoint/move-endpoint', input: { id: 'P-D-EP01', query_id: 'P-D-QRY01' } }]));
    expect(writes).toEqual([]);
  });

  it('adds an endpoint test under an API requirement with the next free ID, through Add an endpoint test', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/P-D-EP01-R01', { data: modelWorkspace(), command: () => ({ answer: ok }) });
    await user.click(within(await toolbar('P-D-EP01-R01')).getByRole('button', { name: 'Add endpoint test' }));
    const form = screen.getByRole('form', { name: 'Add an endpoint test' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('P-D-EP01-R01-T01'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Answers 201');
    await user.selectOptions(within(form).getByRole('combobox', { name: /^level/ }), 'service');
    await user.selectOptions(within(form).getByRole('combobox', { name: /^state/ }), 'not automated yet');
    await user.click(within(form).getByRole('button', { name: 'Add endpoint test' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/endpoint/add-endpoint-test', input: { api_requirement_id: 'P-D-EP01-R01', id: 'P-D-EP01-R01-T01', title: 'Answers 201', level: 'service', state: 'not automated yet' } }]));
  });

  it('adds an endpoint from its command\'s page through the aggregate\'s own Add, naming the command it exposes', async () => {
    const user = userEvent.setup();
    const { commands, writes } = await openApp('/P-D-CMD02', { data: modelWorkspace(), command: () => ({ answer: ok }) });
    const actions = await toolbar('P-D-CMD02');
    await user.click(within(actions).getByRole('button', { name: 'Add…' }));
    await user.click(within(actions).getByRole('button', { name: 'Endpoint' }));
    const form = screen.getByRole('form', { name: 'Add an endpoint' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('P-D-EP03'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'POST /returns');
    await user.selectOptions(within(form).getByRole('combobox', { name: /^method/ }), 'POST');
    await user.type(within(form).getByRole('textbox', { name: /^route/ }), '/returns');
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), 'Returns a thing.');
    await user.click(within(form).getByRole('button', { name: 'Add endpoint' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/endpoint/add-endpoint', input: { command_id: 'P-D-CMD02', id: 'P-D-EP03', title: 'POST /returns', method: 'POST', route: '/returns', description: 'Returns a thing.' } }]));
    expect(writes).toEqual([]);
  });
});

describe('LA-V152-R03-T01 a refused Endpoint command shows every reason, keeps what was entered, and changes nothing', () => {
  it('Remove sends Remove an endpoint, saying what goes with it, and shows the refusal', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'endpoint', key: 'P-D-EP01', message: 'Endpoint P-D-EP01 is referenced, so it stays: flow step P-D-UC01-FL01-S01 invokes it' }] };
    const { commands } = await openApp('/P-D-EP01', { data: modelWorkspace(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('P-D-EP01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove P-D-EP01?' });
    const goes = within(panel).getByRole('list', { name: 'What goes with P-D-EP01' });
    expect(goes).toHaveTextContent('P-D-EP01-H');
    expect(goes).toHaveTextContent('P-D-EP01-R01');
    await user.click(within(panel).getByRole('button', { name: 'Remove P-D-EP01' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The removal was refused. Nothing was changed.');
    expect(alert).toHaveTextContent('flow step P-D-UC01-FL01-S01 invokes it');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/endpoint/remove-endpoint', input: { id: 'P-D-EP01' } }]);
    expect(window.location.pathname).toBe('/P-D-EP01');
  });

  it('a refused change keeps the draft and shows the reason', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'title', table: 'endpoint', key: 'P-D-EP01', message: 'Endpoint P-D-EP01 is titled by its method and route, POST /loans' }] };
    const { commands } = await openApp('/P-D-EP01', { data: modelWorkspace(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('P-D-EP01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-D-EP01' });
    const title = within(form).getByRole('textbox', { name: /^title/ });
    await user.clear(title);
    await user.type(title, 'Open a loan');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('is titled by its method and route, POST /loans');
    expect(alert).toHaveFocus();
    expect(title).toHaveValue('Open a loan');
    expect(commands).toEqual([{ route: '/api/endpoint/change-endpoint', input: { id: 'P-D-EP01', title: 'Open a loan' } }]);
  });
});

describe('LA-V152-R04-T01 an endpoint\'s page lists its API requirements in a section with their count, each with the tests that prove it', () => {
  it('lists the requirement under the API requirements heading with its count, and Nothing yet where no test proves it', async () => {
    await openApp('/DM-SHOP-EP01');
    await screen.findByRole('heading', { level: 1, name: 'POST /basket/items' });
    const requirements = await waitFor(() => section(/^API requirements/));
    expect(within(main()).getByRole('heading', { name: /^API requirements/ })).toHaveTextContent('API requirements1');
    expect(within(requirements).getByRole('link', { name: /DM-SHOP-EP01-R01/ })).toHaveAttribute('href', '/DM-SHOP-EP01-R01');
    expect(within(requirements).getByRole('row', { name: /DM-SHOP-EP01-R01/ })).toHaveTextContent('Nothing yet');
  });
});
