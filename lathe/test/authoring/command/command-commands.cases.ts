// The commands of the command aggregate, run on a store as the CLI, the MCP tools and HTTP run them. Its cases are proved by
// LA-PAT-AGGREGATE-COMMANDS-R10-T01, which runs them from lathe/test/authoring/aggregate/aggregate-commands.test.ts.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { ADD_COMMAND_HANDLER } from '../../../src/authoring/command/commands/add-command-handler.ts';
import { ADD_EVENT_HANDLER } from '../../../src/authoring/command/commands/add-event-handler.ts';
import { ADD_POLICY } from '../../../src/authoring/command/commands/add-policy.ts';
import { CHANGE_COMMAND } from '../../../src/authoring/command/commands/change-command.ts';
import { CHANGE_COMMAND_HANDLER } from '../../../src/authoring/command/commands/change-command-handler.ts';
import { CHANGE_EVENT_HANDLER } from '../../../src/authoring/command/commands/change-event-handler.ts';
import { CHANGE_POLICY } from '../../../src/authoring/command/commands/change-policy.ts';
import { CHANGE_POLICY_TEST } from '../../../src/authoring/command/commands/change-policy-test.ts';
import { GET_COMMAND, LIST_COMMANDS, NEXT_COMMAND_ID } from '../../../src/authoring/command/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { type Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';
import { domainModelBase } from '../domain-model-base.ts';
import { commandDataSet } from './data-set.ts';

/** The refusal a command gets, or a failure when it is not refused. */
async function refusal(store: Store, definition: AnyCommand, input: unknown): Promise<StoreError> {
  try {
    await runCommand(store, definition, input);
  } catch (error) {
    if (error instanceof StoreError) return error;
    throw error;
  }
  throw new Error(`${definition.name} was not refused`);
}

type Whole = ReturnType<typeof GET_COMMAND.run>;

export function commandCommandCases(): void {
  it('builds the data set with its own Add commands, and reads a command whole by any record in it', async () => {
    const store = await commandDataSet();
    const whole = runQuery(store, GET_COMMAND, { id: 'TL-LEND-PO01-T' }) as Whole;
    expect(whole).toMatchObject({ record: { id: 'TL-LEND-PO01-T', kind: 'policy_test' }, command: { id: 'TL-LEND-CMD01' }, raises: ['TL-LEND-EV01'], checks: ['TL-LEND-SP01'], calls: ['TL-LEND-DS01'], policies: [{ hears: 'TL-LEND-EV01' }] });
    expect(whole.handler).toMatchObject({ handler: { id: 'TL-LEND-CMD01-H' }, meets: ['TL-STD-CODE-R01'] });
    expect(whole.policies.map((p) => p.eventHandler?.handler.id)).toEqual(['TL-LEND-PO01-H']);
    expect(whole.policies[0].test?.startsFrom).toEqual(['TL-LEND-TD01']);
    expect(runQuery(store, LIST_COMMANDS, { entity_id: 'TL-LEND-EN01' })).toEqual([{ id: 'TL-LEND-CMD01', title: 'Open a loan' }]);
    expect(runQuery(store, NEXT_COMMAND_ID, { kind: 'command', parent: 'TL-LEND-EN01' })).toBe('TL-LEND-CMD02');
    expect(runQuery(store, NEXT_COMMAND_ID, { kind: 'policy', parent: 'TL-LEND-CMD01' })).toBe('TL-LEND-PO02');
    expect(() => runQuery(store, NEXT_COMMAND_ID, { kind: 'command_handler', parent: 'TL-LEND-CMD01' })).toThrow(/already has its command handler, TL-LEND-CMD01-H/);
    expect(() => runQuery(store, NEXT_COMMAND_ID, { kind: 'policy', parent: 'TL-LEND-EN01' })).toThrow(/a policy sits under a command, and TL-LEND-EN01 is an entity/);
  });

  it('changes each kind, writing only its own tables: a list given replaces its list, null clears a link or an optional column', async () => {
    const store = await commandDataSet();
    expect((await runCommand(store, CHANGE_COMMAND, { id: 'TL-LEND-CMD01', raises: [], calls: [] })).tables).toEqual(['calls', 'raises']);
    expect((await runCommand(store, CHANGE_COMMAND_HANDLER, { id: 'TL-LEND-CMD01-H', file: null, packages: ['zod'] })).tables).toEqual(['command_handler', 'package_use']);
    expect((await runCommand(store, CHANGE_POLICY, { id: 'TL-LEND-PO01', hears: null })).tables).toEqual(['hears']);
    expect((await runCommand(store, CHANGE_EVENT_HANDLER, { id: 'TL-LEND-PO01-H', meets: ['TL-STD-CODE-R01'] })).tables).toEqual(['meets']);
    expect((await runCommand(store, CHANGE_POLICY_TEST, { id: 'TL-LEND-PO01-T', level: 'integration' })).tables).toEqual(['policy_test']);
  });

  it('refuses a second handler or event handler, an input that is not the command\'s, and a record that is not there', async () => {
    const store = await commandDataSet();
    expect((await refusal(store, ADD_COMMAND_HANDLER, { id: 'TL-LEND-CMD01-H2', title: 'openLoanAgain', command_id: 'TL-LEND-CMD01', description: 'x' })).problems[0]).toMatchObject({ rule: 'command-one-each', message: 'command TL-LEND-CMD01 already has its command handler, so TL-LEND-CMD01-H2 cannot be a second: a command has one' });
    expect((await refusal(store, ADD_EVENT_HANDLER, { id: 'TL-LEND-PO01-H2', title: 'again', policy_id: 'TL-LEND-PO01', description: 'x' })).problems[0].rule).toBe('command-one-each');
    await expect(runCommand(store, CHANGE_COMMAND, { id: 'TL-LEND-CMD01', entity_id: 'TL-LEND-EN01' })).rejects.toThrow(/change-command takes no entity_id/);
    await expect(runCommand(store, CHANGE_POLICY, { id: 'TL-LEND-PO01', hears: ['TL-LEND-EV01'] })).rejects.toThrow(/hears .* is not a record ID/);
    expect((await refusal(store, ADD_POLICY, { id: 'TL-LEND-PO02', title: 'x', command_id: 'TL-LEND-CMD09', statement: 'x' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no command TL-LEND-CMD09' });
  });

  it('runs `lathe command <command>`, the command_ tools and POST /api/command/<command>', async () => {
    const root = writeData(
      domainModelBase({
        aggregate: [{ id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'A loan.' }],
        entity: [{ id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan.' }],
      }),
    );
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    expect(await runAggregateCommand(['command', 'add-command', '--id', 'TL-LEND-CMD01', '--title', 'Open a loan', '--entity_id', 'TL-LEND-EN01', '--description', 'Lends a tool.', '--checks', 'TL-LEND-SP01', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added checks source_id TL-LEND-CMD01, target_id TL-LEND-SP01');
    expect((await callTool(root, 'command_add_command_handler', { id: 'TL-LEND-CMD01-H', title: 'openLoan', command_id: 'TL-LEND-CMD01', description: 'Opens it.' })).isError).toBeUndefined();
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/command/add-policy', { id: 'TL-LEND-PO01', title: 'Remind', command_id: 'TL-LEND-CMD01', statement: 'Whenever, then.' })).status).toBe(200);
      expect((await post('/api/command/remove-command', { id: 'TL-LEND-CMD09' })).status).toBe(422);
      expect((await post('/api/command/add-policy', { id: 'TL-LEND-PO02', colour: 'red' })).status).toBe(400);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
