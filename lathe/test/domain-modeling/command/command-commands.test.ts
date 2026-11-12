// The Command aggregate's commands, queries and refusals (LA-MOD-A8), run on a store as the CLI, the MCP tools and the
// HTTP API run them: each command changes one command through CommandRepository, holds it to its rules before it
// saves, and is refused with its reason, changing nothing.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_POLICY } from '../../../src/domain-modeling/command/commands/add-policy.ts';
import { CHANGE_POLICY } from '../../../src/domain-modeling/command/commands/change-policy.ts';
import { GET_COMMAND } from '../../../src/domain-modeling/command/queries.ts';
import { ADD_INTEGRATION } from '../../../src/interface-design/integration/commands/add-integration.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';
import { closeOpenStores, domainModelBase } from '../domain-model-base.ts';
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

describe('LA-MOD-INV70-T a policy hearing another domain\'s unpublished event is refused, one hearing a published one is not', () => {
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

describe('LA-MOD-UC44-R01-T01 a policy names the integrations it exchanges with', () => {
  it('adds and changes a policy\'s exchanges, writing only that link, and reads them with its command', async () => {
    const store = await commandDataSet();
    await runCommand(store, ADD_INTEGRATION, { id: 'TL-INT01', title: 'Mail', system: 'The library\'s mail service', description: 'Reminders sent to members.' });
    expect((await runCommand(store, CHANGE_POLICY, { id: 'TL-LEND-PO01', exchanges_with: ['TL-INT01'] })).tables).toEqual(['exchanges_with']);
    expect(store.rows('exchanges_with')).toEqual([{ source_id: 'TL-LEND-PO01', target_id: 'TL-INT01' }]);
    const whole = runQuery(store, GET_COMMAND, { id: 'TL-LEND-PO01' }) as ReturnType<typeof GET_COMMAND.run>;
    expect(whole.policies[0]).toMatchObject({ hears: 'TL-LEND-EV01', exchangesWith: ['TL-INT01'] });
    await runCommand(store, ADD_POLICY, { id: 'TL-LEND-PO02', title: 'Mail on loan', command_id: 'TL-LEND-CMD01', statement: 'Whenever a loan is opened, the library MUST mail the member.', hears: 'TL-LEND-EV01', exchanges_with: ['TL-INT01'] });
    expect(store.rows('exchanges_with')).toContainEqual({ source_id: 'TL-LEND-PO02', target_id: 'TL-INT01' });
    // An integration that is not there is refused.
    expect((await refusal(store, CHANGE_POLICY, { id: 'TL-LEND-PO01', exchanges_with: ['TL-INT09'] })).problems[0].rule).toBe('foreign-key');
  });
});
