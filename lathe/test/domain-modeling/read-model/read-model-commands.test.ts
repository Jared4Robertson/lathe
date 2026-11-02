// The Read model aggregate's commands, queries and refusals (LA-MOD-A10), run on a store as the CLI, the MCP tools and
// the HTTP API run them: each command changes one read model through ReadModelRepository, holds it to its rules before
// it saves, and is refused with its reason, changing nothing.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_READ_MODEL } from '../../../src/domain-modeling/read-model/commands/add-read-model.ts';
import { CHANGE_READ_MODEL } from '../../../src/domain-modeling/read-model/commands/change-read-model.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';
import { closeOpenStores, domainModelBase } from '../domain-model-base.ts';
import { AROUND, readModelDataSet } from './data-set.ts';

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

describe("LA-MOD-INV80-T a read model fed by another domain's unpublished event is refused, one fed by a published one is not", () => {
  it('refuses Add a read model and Change a read model fed by it, with its reason, and changes no file', async () => {
    const store = await readModelDataSet();
    const before = fileOf(store, 'fed_by');
    expect((await refusal(store, CHANGE_READ_MODEL, { id: 'TL-LEND-RM01', fed_by: ['TL-LEND-EV01', 'TL-CAT-EV01'] })).problems).toEqual([
      expect.objectContaining({ rule: 'read-model-fed-by-published', message: 'TL-LEND-RM01 is a read model of domain TL-LEND, so it cannot be fed by TL-CAT-EV01, an event of domain TL-CAT that is not published' }),
    ]);
    expect((await refusal(store, ADD_READ_MODEL, { id: 'TL-LEND-RM02', title: 'Listings', domain_id: 'TL-LEND', description: 'x', fed_by: ['TL-CAT-EV01'] })).problems.map((p) => p.rule)).toEqual(['read-model-fed-by-published']);
    expect(fileOf(store, 'fed_by')).toBe(before);
  });

  it('refuses data files where a read model is fed by it when they are loaded, and loads them once the event is published', async () => {
    const store = await readModelDataSet();
    const data = domainModelBase({ ...AROUND, read_model: store.rows('read_model'), fed_by: [{ source_id: 'TL-LEND-RM01', target_id: 'TL-CAT-EV01' }] });
    const refused = await openStore(writeData(data), { latheDataDir: null }).catch((error: unknown) => error);
    expect((refused as StoreError).problems).toEqual([expect.objectContaining({ rule: 'read-model-fed-by-published', file: 'data/fed_by.jsonl', line: 1 })]);
    data.domain_event = data.domain_event.map((e) => (e.id === 'TL-CAT-EV01' ? { ...e, published: true } : e));
    await (await openStore(writeData(data), { latheDataDir: null })).close();
  });
});
