// The Command aggregate's commands, queries and refusals (LA-AUT-A8), run on a store as the CLI, the MCP tools and the
// HTTP API run them: each command changes one command through CommandRepository, holds it to its rules before it
// saves, and is refused with its reason, changing nothing.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_COMMAND_HANDLER } from '../../../src/authoring/command/commands/add-command-handler.ts';
import { ADD_EVENT_HANDLER } from '../../../src/authoring/command/commands/add-event-handler.ts';
import { ADD_POLICY } from '../../../src/authoring/command/commands/add-policy.ts';
import { CHANGE_COMMAND } from '../../../src/authoring/command/commands/change-command.ts';
import { CHANGE_COMMAND_HANDLER } from '../../../src/authoring/command/commands/change-command-handler.ts';
import { CHANGE_EVENT_HANDLER } from '../../../src/authoring/command/commands/change-event-handler.ts';
import { CHANGE_POLICY } from '../../../src/authoring/command/commands/change-policy.ts';
import { CHANGE_POLICY_TEST } from '../../../src/authoring/command/commands/change-policy-test.ts';
import { REMOVE_COMMAND } from '../../../src/authoring/command/commands/remove-command.ts';
import { REMOVE_COMMAND_HANDLER } from '../../../src/authoring/command/commands/remove-command-handler.ts';
import { REMOVE_EVENT_HANDLER } from '../../../src/authoring/command/commands/remove-event-handler.ts';
import { REMOVE_POLICY } from '../../../src/authoring/command/commands/remove-policy.ts';
import { REMOVE_POLICY_TEST } from '../../../src/authoring/command/commands/remove-policy-test.ts';
import { GET_COMMAND, LIST_COMMANDS, NEXT_COMMAND_ID } from '../../../src/authoring/command/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';
import { closeOpenStores, domainModelBase, storeOn } from '../domain-model-base.ts';
import { commandDataSet } from './data-set.ts';

afterEach(closeOpenStores);

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

const fileOf = (store: Store, table: string) => readFileSync(path.join(store.dataDir, `${table}.jsonl`), 'utf8');
type Whole = ReturnType<typeof GET_COMMAND.run>;

describe('LA-AUT-UC12-R50-T01 each Command command (LA-AUT-A8) changes one command through CommandRepository, held to its rules, and is reached by name from the CLI, the MCP tools and HTTP', () => {
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
});

describe('LA-AUT-INV70-T a policy hearing another domain\'s unpublished event is refused, one hearing a published one is not', () => {
  it('refuses Add a policy and Change a policy hearing it, with its reason, and changes no file', async () => {
    const store = await commandDataSet();
    const before = fileOf(store, 'hears');
    const refused = await refusal(store, CHANGE_POLICY, { id: 'TL-LEND-PO01', hears: 'TL-CAT-EV01' });
    expect(refused.problems).toEqual([
      expect.objectContaining({ rule: 'policy-hears-published', message: 'TL-LEND-PO01 is a policy of domain TL-LEND, so it cannot hear TL-CAT-EV01, an event of domain TL-CAT that is not published' }),
    ]);
    expect((await refusal(store, ADD_POLICY, { id: 'TL-LEND-PO02', title: 'Relist', command_id: 'TL-LEND-CMD01', statement: 'Whenever, then.', hears: 'TL-CAT-EV01' })).problems.map((p) => p.rule)).toEqual(['policy-hears-published']);
    expect(fileOf(store, 'hears')).toBe(before);
  });

  it('refuses data files where a policy hears it when they are loaded, and loads them once the event is published', async () => {
    const store = await commandDataSet();
    const data = domainModelBase(Object.fromEntries(['aggregate', 'entity', 'domain_event', 'command', 'policy'].map((t) => [t, store.rows(t)])));
    data.hears = [{ source_id: 'TL-LEND-PO01', target_id: 'TL-CAT-EV01' }];
    const refused = await openStore(writeData(data), { latheDataDir: null }).catch((error: unknown) => error);
    expect((refused as StoreError).problems).toEqual([expect.objectContaining({ rule: 'policy-hears-published', file: 'data/hears.jsonl', line: 1 })]);
    data.domain_event = data.domain_event.map((e) => (e.id === 'TL-CAT-EV01' ? { ...e, published: true } : e));
    await (await openStore(writeData(data), { latheDataDir: null })).close();
  });
});

describe('LA-STD-CODE-R07-T32 a command, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
  it('removes a handler, an event handler, a policy test and a policy with what is under it', async () => {
    const store = await commandDataSet();
    expect((await runCommand(store, REMOVE_COMMAND_HANDLER, { id: 'TL-LEND-CMD01-H' })).changes.map((c) => c.table).sort()).toEqual(['command_handler', 'meets']);
    expect((await runCommand(store, REMOVE_POLICY_TEST, { id: 'TL-LEND-PO01-T' })).changes.map((c) => c.table).sort()).toEqual(['policy_test', 'starts_from']);
    expect((await runCommand(store, REMOVE_EVENT_HANDLER, { id: 'TL-LEND-PO01-H' })).changes.map((c) => c.table)).toEqual(['event_handler']);
    await runCommand(store, ADD_EVENT_HANDLER, { id: 'TL-LEND-PO01-H', title: 'onLoanOpened', policy_id: 'TL-LEND-PO01', description: 'Hears it.' });
    expect((await runCommand(store, REMOVE_POLICY, { id: 'TL-LEND-PO01' })).changes.map((c) => c.table).sort()).toEqual(['event_handler', 'hears', 'policy']);
  });

  it('removes a command whole, and refuses one while anything outside it references it', async () => {
    const store = await commandDataSet();
    const removed = await runCommand(store, REMOVE_COMMAND, { id: 'TL-LEND-CMD01' });
    expect(new Set(removed.changes.map((c) => c.table))).toEqual(new Set(['command', 'command_handler', 'policy', 'event_handler', 'policy_test', 'raises', 'checks', 'calls', 'hears', 'meets', 'starts_from']));
    const referenced = await storeWithEndpoint();
    expect((await refusal(referenced, REMOVE_COMMAND, { id: 'TL-LEND-CMD01' })).problems[0].message).toBe('Command TL-LEND-CMD01 is referenced, so it stays: endpoint TL-LEND-EP01 (command_id)');
  });
});

// The data set with an endpoint under its command, of the Endpoint aggregate.
async function storeWithEndpoint(): Promise<Store> {
  const store = await commandDataSet();
  const data = domainModelBase(Object.fromEntries(['aggregate', 'entity', 'domain_event', 'command'].map((t) => [t, store.rows(t)])));
  data.endpoint = [{ id: 'TL-LEND-EP01', title: 'POST /loans', command_id: 'TL-LEND-CMD01', method: 'POST', route: '/loans', description: 'Opens a loan.' }];
  return storeOn(data);
}
