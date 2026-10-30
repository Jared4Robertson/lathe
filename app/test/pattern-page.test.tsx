import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PATTERN_COMMANDS } from '../../lathe/src/authoring/pattern/commands/index';
import type { PatternCommands } from '../src/authoring/pattern/commands';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { setRow } from './fixtures/load';
import { patternWorkspace } from './fixtures/patterns';
import { main, openApp } from './helpers';

// The Pattern page and its editor (LA-AUT-A2, LA-V122): a pattern and its rules and tests are read through the
// aggregate's own query, and changed only through the aggregate's own commands, one per change, each refusal shown
// with its reasons. What the page shows of followers is in patterns.test.tsx (LA-V122-R04, R05).

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

describe('LA-V122-R01-T01 a pattern\'s records are read through the Pattern aggregate\'s own query, never a generic record read', () => {
  it('reads GET /api/pattern/get-pattern for a rule, and shows its statement and the domains that owe it', async () => {
    const { requests } = await openApp('/DM-PAT-AUDIT-R02', { data: patternWorkspace() });
    expect(await within(main()).findByText(/Records MUST be kept for/)).toBeInTheDocument();
    expect(requests).toContain('GET /api/pattern/get-pattern?id=DM-PAT-AUDIT-R02');
    expect(within(main()).getByRole('heading', { name: /^Owed by/ })).toBeInTheDocument();
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof PatternCommands)[] = [
      '/api/pattern/add-pattern', '/api/pattern/add-pattern-rule', '/api/pattern/add-pattern-rule-test',
      '/api/pattern/change-pattern', '/api/pattern/change-pattern-rule', '/api/pattern/change-pattern-rule-test',
      '/api/pattern/remove-pattern', '/api/pattern/remove-pattern-rule', '/api/pattern/remove-pattern-rule-test',
    ];
    expect([...routes].sort()).toEqual(PATTERN_COMMANDS.map((c) => c.route).sort());
  });
});

describe('LA-V122-R02-T01 the Pattern editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a pattern with its settings, the whole list in order, and offers no Move', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-PAT-AUDIT', { data: patternWorkspace(), command: () => ({ answer: ok }) });
    const actions = await toolbar('DM-PAT-AUDIT');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add pattern rule', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-PAT-AUDIT' });
    await user.click(within(form).getByRole('button', { name: 'Remove Settings: row 2' }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/pattern/change-pattern', input: { id: 'DM-PAT-AUDIT', settings: [{ name: 'retention', meaning: 'How long records are kept.' }] } }]));
  });

  it('adds a rule test under a rule with the next free ID, naming the domain it proves the rule in', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-PAT-AUDIT-R01', { data: patternWorkspace(), command: () => ({ answer: ok }) });
    await user.click(within(await toolbar('DM-PAT-AUDIT-R01')).getByRole('button', { name: 'Add pattern rule test' }));
    const form = screen.getByRole('form', { name: 'Add a pattern rule test' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-PAT-AUDIT-R01-T02'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Paying is recorded');
    await user.selectOptions(within(form).getByRole('combobox', { name: /^Domain/ }), 'DM-PAY');
    await user.type(within(form).getByRole('textbox', { name: /^when/ }), 'A shopper pays.');
    await user.type(within(form).getByRole('textbox', { name: /^then/ }), 'The payment is recorded.');
    await user.click(within(form).getByRole('button', { name: 'Add pattern rule test' }));
    await waitFor(() => expect(commands.map((c) => c.route)).toEqual(['/api/pattern/add-pattern-rule-test']));
    expect(commands[0].input).toMatchObject({ pattern_rule_id: 'DM-PAT-AUDIT-R01', id: 'DM-PAT-AUDIT-R01-T02', title: 'Paying is recorded', domain_id: 'DM-PAY', when: 'A shopper pays.', then: 'The payment is recorded.' });
  });

  it('a rule test\'s page shows its domain and scenario, and Edit sends Change a pattern rule test', async () => {
    const user = userEvent.setup();
    const changed = () => setRow(patternWorkspace(), 'pattern_rule_test', 'DM-PAT-AUDIT-R01-T01', { then: 'The change is in the audit log.' });
    const { commands } = await openApp('/DM-PAT-AUDIT-R01-T01', { data: patternWorkspace(), command: () => ({ answer: ok, data: changed() }) });
    const scenario = await within(main()).findByLabelText('Scenario');
    expect(scenario).toHaveTextContent('Expects what the title says.');
    await user.click(within(await toolbar('DM-PAT-AUDIT-R01-T01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-PAT-AUDIT-R01-T01' });
    const then = within(form).getByRole('textbox', { name: /^then/ });
    await user.clear(then);
    await user.type(then, 'The change is in the audit log.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/pattern/change-pattern-rule-test', input: { id: 'DM-PAT-AUDIT-R01-T01', then: 'The change is in the audit log.' } }]));
  });
});

describe('LA-V122-R03-T01 a refused Pattern command shows every reason, keeps what was entered, and changes nothing', () => {
  it('a refused Add keeps the form with what was entered and every reason at its top', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'setting', table: 'pattern_rule', key: 'DM-PAT-AUDIT-R04', message: 'DM-PAT-AUDIT-R04 names the setting scope, which DM-PAT-AUDIT does not have' }] };
    const { commands } = await openApp('/DM-PAT-AUDIT', { data: patternWorkspace(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('DM-PAT-AUDIT')).getByRole('button', { name: 'Add pattern rule' }));
    const form = screen.getByRole('form', { name: 'Add a pattern rule' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-PAT-AUDIT-R04'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Scope is named');
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), 'The scope MUST be named.');
    await user.click(within(form).getByRole('button', { name: 'Add pattern rule' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused. Nothing was saved.');
    expect(alert).toHaveTextContent('which DM-PAT-AUDIT does not have');
    expect(alert).toHaveFocus();
    expect(within(form).getByRole('textbox', { name: /^title/ })).toHaveValue('Scope is named');
    expect(commands.map((c) => c.route)).toEqual(['/api/pattern/add-pattern-rule']);
  });
});
