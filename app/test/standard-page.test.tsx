import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { STANDARD_COMMANDS } from '../../lathe/src/authoring/standard/commands/index';
import type { StandardCommands } from '../src/authoring/standard/commands';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { setRow } from './fixtures/load';
import { standardWorkspace } from './fixtures/standards';
import { main, openApp } from './helpers';

// The Standard page and its editor (LA-AUT-A3, LA-V123): a standard and its rules and tests are read through the
// aggregate's own query, and changed only through the aggregate's own commands, one per change, each refusal shown
// with its reasons. The rules table is in engineering-standards.test.tsx (LA-V123-R04).

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

describe('LA-V123-R01-T01 a standard\'s records are read through the Standard aggregate\'s own query, never a generic record read', () => {
  it('reads GET /api/standard/get-standard for a rule, and shows its statement', async () => {
    const { requests } = await openApp('/DM-STD-CODE-R01', { data: standardWorkspace() });
    expect(await within(main()).findByText('A command handler MUST own its transaction.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/standard/get-standard?id=DM-STD-CODE-R01');
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof StandardCommands)[] = [
      '/api/standard/add-standard', '/api/standard/add-standard-rule', '/api/standard/add-standard-rule-test',
      '/api/standard/change-standard', '/api/standard/change-standard-rule', '/api/standard/change-standard-rule-test',
      '/api/standard/remove-standard', '/api/standard/remove-standard-rule', '/api/standard/remove-standard-rule-test',
    ];
    expect([...routes].sort()).toEqual(STANDARD_COMMANDS.map((c) => c.route).sort());
  });
});

describe('LA-V123-R02-T01 the Standard editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a standard rule with only what changed; an emptied group is cleared with null; no Move', async () => {
    const user = userEvent.setup();
    const changed = () => setRow(standardWorkspace(), 'standard_rule', 'DM-STD-CODE-R01', { group_name: null });
    const { commands, writes } = await openApp('/DM-STD-CODE-R01', { data: standardWorkspace(), command: () => ({ answer: ok, data: changed() }) });
    const actions = await toolbar('DM-STD-CODE-R01');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add standard rule test', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-STD-CODE-R01' });
    await user.clear(within(form).getByRole('textbox', { name: /^group name/ }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/standard/change-standard-rule', input: { id: 'DM-STD-CODE-R01', group_name: null } }]));
    expect(writes).toEqual([]);
  });

  it('adds a rule under the standard with the next free ID, through Add a standard rule', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-STD-CODE', { data: standardWorkspace(), command: () => ({ answer: ok }) });
    await user.click(within(await toolbar('DM-STD-CODE')).getByRole('button', { name: 'Add standard rule' }));
    const form = screen.getByRole('form', { name: 'Add a standard rule' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-STD-CODE-R03'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Names are nouns');
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), 'A table MUST be named by a noun.');
    await user.click(within(form).getByRole('button', { name: 'Add standard rule' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/standard/add-standard-rule', input: { standard_id: 'DM-STD-CODE', id: 'DM-STD-CODE-R03', title: 'Names are nouns', statement: 'A table MUST be named by a noun.' } }]));
  });
});

describe('LA-V123-R03-T01 a refused Standard command shows every reason, keeps what was entered, and changes nothing', () => {
  it('Remove sends Remove a standard rule and shows the refusal naming what still meets it', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'standard_rule', key: 'DM-STD-CODE-R01', message: 'Standard rule DM-STD-CODE-R01 is referenced, so it stays: command handler DM-SHOP-CMD01-H meets it' }] };
    const { commands } = await openApp('/DM-STD-CODE-R01', { data: standardWorkspace(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('DM-STD-CODE-R01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove DM-STD-CODE-R01?' });
    expect(within(panel).getByRole('list', { name: 'What goes with DM-STD-CODE-R01' })).toHaveTextContent('DM-STD-CODE-R01-T01');
    await user.click(within(panel).getByRole('button', { name: 'Remove DM-STD-CODE-R01' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The removal was refused. Nothing was changed.');
    expect(alert).toHaveTextContent('command handler DM-SHOP-CMD01-H meets it');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/standard/remove-standard-rule', input: { id: 'DM-STD-CODE-R01' } }]);
    expect(window.location.pathname).toBe('/DM-STD-CODE-R01');
  });
});
