import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { INTEGRATION_COMMANDS } from '../../lathe/src/authoring/integration/commands/index';
import type { IntegrationCommands } from '../src/authoring/integration/commands';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { modelWorkspace } from './fixtures/model';
import { facts, main, openApp, section } from './helpers';

// The Integration page and its editor (LA-AUT-A14, LA-V153): an integration and its adapter and tests are read through
// the aggregate's own query, and changed only through the aggregate's own commands, one per change, each refusal shown
// with its reasons. The aggregate has no Move.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

describe('LA-V153-R01-T01 an integration\'s records are read through the Integration aggregate\'s own query, never a generic record read', () => {
  it('reads GET /api/integration/get-integration for the adapter, and shows its description', async () => {
    const { requests } = await openApp('/P-INT01-AD', { data: modelWorkspace() });
    expect(await within(main()).findByText("The fixture's adapter mailer.")).toBeInTheDocument();
    expect(requests).toContain('GET /api/integration/get-integration?id=P-INT01-AD');
  });

  it('shows an integration\'s adapter from the read, and that it has no tests yet', async () => {
    await openApp('/P-INT01', { data: modelWorkspace() });
    const adapter = await screen.findByRole('list', { name: 'The adapter of P-INT01' });
    expect(within(adapter).getByRole('link', { name: /P-INT01-AD/ })).toHaveAttribute('href', '/P-INT01-AD');
    expect(section(/^Integration tests/)).toHaveTextContent('No integration tests yet.');
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof IntegrationCommands)[] = [
      '/api/integration/add-integration', '/api/integration/change-integration', '/api/integration/remove-integration',
      '/api/integration/add-adapter', '/api/integration/change-adapter', '/api/integration/remove-adapter',
      '/api/integration/add-integration-test', '/api/integration/change-integration-test', '/api/integration/remove-integration-test',
    ];
    expect([...routes].sort()).toEqual(INTEGRATION_COMMANDS.map((c) => c.route).sort());
  });
});

describe('LA-V153-R02-T01 the Integration editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change an integration with only what changed; an emptied system is cleared with null; no Move', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/P-INT01', { data: modelWorkspace(), command: () => ({ answer: ok }) });
    const actions = await toolbar('P-INT01');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add integration test', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-INT01' });
    await user.clear(within(form).getByRole('textbox', { name: /^system/ }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/integration/change-integration', input: { id: 'P-INT01', system: null } }]));
  });

  it('Edit sends Change an adapter with its packages, one per line, as a whole list', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/P-INT01-AD', { data: modelWorkspace(), command: () => ({ answer: ok }) });
    const actions = await toolbar('P-INT01-AD');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-INT01-AD' });
    await user.type(within(form).getByRole('textbox', { name: /^packages/ }), 'nodemailer');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/integration/change-adapter', input: { id: 'P-INT01-AD', packages: ['nodemailer'] } }]));
  });

  it('adds an integration test under the integration with the next free ID, through Add an integration test', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/P-INT01', { data: modelWorkspace(), command: () => ({ answer: ok }) });
    await user.click(within(await toolbar('P-INT01')).getByRole('button', { name: 'Add integration test' }));
    const form = screen.getByRole('form', { name: 'Add an integration test' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('P-INT01-T01'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Sends a mail');
    await user.selectOptions(within(form).getByRole('combobox', { name: /^level/ }), 'integration');
    await user.selectOptions(within(form).getByRole('combobox', { name: /^state/ }), 'not automated yet');
    await user.click(within(form).getByRole('button', { name: 'Add integration test' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/integration/add-integration-test', input: { integration_id: 'P-INT01', id: 'P-INT01-T01', title: 'Sends a mail', level: 'integration', state: 'not automated yet' } }]));
  });

  it('adds an integration from its product\'s page through the aggregate\'s own Add, with the next free ID', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/P', { data: modelWorkspace(), command: () => ({ answer: ok }) });
    const actions = await toolbar('P');
    await user.click(within(actions).getByRole('button', { name: 'Add…' }));
    await user.click(within(actions).getByRole('button', { name: 'Integration' }));
    const form = screen.getByRole('form', { name: 'Add an integration' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('P-INT02'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Payments');
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), 'Takes the fees.');
    await user.click(within(form).getByRole('button', { name: 'Add integration' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/integration/add-integration', input: { id: 'P-INT02', title: 'Payments', description: 'Takes the fees.' } }]));
  });
});

describe('LA-V153-R03-T01 a refused Integration command shows every reason, keeps what was entered, and changes nothing', () => {
  it('Remove sends Remove an integration, saying what goes with it, and shows the refusal naming the step that exchanges with it', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'integration', key: 'P-INT01', message: 'Integration P-INT01 is referenced, so it stays: flow step P-D-UC01-FL01-S02 exchanges with it' }] };
    const { commands } = await openApp('/P-INT01', { data: modelWorkspace(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('P-INT01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove P-INT01?' });
    expect(within(panel).getByRole('list', { name: 'What goes with P-INT01' })).toHaveTextContent('P-INT01-AD');
    await user.click(within(panel).getByRole('button', { name: 'Remove P-INT01' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The removal was refused. Nothing was changed.');
    expect(alert).toHaveTextContent('flow step P-D-UC01-FL01-S02 exchanges with it');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/integration/remove-integration', input: { id: 'P-INT01' } }]);
    expect(window.location.pathname).toBe('/P-INT01');
  });
});

describe('LA-V153-R04-T01 an integration\'s page lists the flow steps that exchange with it, with their count, and names its outside system', () => {
  it('shows an Exchanged with by section with its count and the step\'s row, and the outside system among its facts', async () => {
    await openApp('/P-INT01', { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Mail' });
    const exchanges = await waitFor(() => section(/^Exchanged with by/));
    expect(within(main()).getByRole('heading', { name: /^Exchanged with by/ })).toHaveTextContent('Exchanged with by1');
    expect(within(exchanges).getByRole('link', { name: /P-D-UC01-FL01-S02/ })).toHaveAttribute('href', '/P-D-UC01-FL01-S02');
    // The outside system, among its facts in the wiki card.
    await waitFor(() => expect(facts()).toHaveTextContent('The mail service'));
  });
});
