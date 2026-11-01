// The Command aggregate's commands, queries and refusals (LA-AUT-A8), run on a store as the CLI, the MCP tools and the
// HTTP API run them: each command changes one command through CommandRepository, holds it to its rules before it
// saves, and is refused with its reason, changing nothing.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_EVENT_HANDLER } from '../../../src/authoring/command/commands/add-event-handler.ts';
import { ADD_POLICY } from '../../../src/authoring/command/commands/add-policy.ts';
import { CHANGE_POLICY } from '../../../src/authoring/command/commands/change-policy.ts';
import { REMOVE_COMMAND } from '../../../src/authoring/command/commands/remove-command.ts';
import { REMOVE_COMMAND_HANDLER } from '../../../src/authoring/command/commands/remove-command-handler.ts';
import { REMOVE_EVENT_HANDLER } from '../../../src/authoring/command/commands/remove-event-handler.ts';
import { REMOVE_POLICY } from '../../../src/authoring/command/commands/remove-policy.ts';
import { REMOVE_POLICY_TEST } from '../../../src/authoring/command/commands/remove-policy-test.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
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
