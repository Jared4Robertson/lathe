// The Read model aggregate's commands, queries and refusals (LA-AUT-A10), run on a store as the CLI, the MCP tools and
// the HTTP API run them: each command changes one read model through ReadModelRepository, holds it to its rules before
// it saves, and is refused with its reason, changing nothing.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_QUERY_HANDLER } from '../../../src/authoring/read-model/commands/add-query-handler.ts';
import { ADD_READ_MODEL } from '../../../src/authoring/read-model/commands/add-read-model.ts';
import { CHANGE_READ_MODEL } from '../../../src/authoring/read-model/commands/change-read-model.ts';
import { REMOVE_PROJECTION } from '../../../src/authoring/read-model/commands/remove-projection.ts';
import { REMOVE_QUERY } from '../../../src/authoring/read-model/commands/remove-query.ts';
import { REMOVE_READER } from '../../../src/authoring/read-model/commands/remove-reader.ts';
import { REMOVE_QUERY_HANDLER } from '../../../src/authoring/read-model/commands/remove-query-handler.ts';
import { REMOVE_READ_MODEL } from '../../../src/authoring/read-model/commands/remove-read-model.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';
import { closeOpenStores, domainModelBase, storeOn } from '../domain-model-base.ts';
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

describe("LA-AUT-INV80-T a read model fed by another domain's unpublished event is refused, one fed by a published one is not", () => {
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

describe('LA-STD-CODE-R07-T52 a read model, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
  it('removes a query handler, a projection, a reader and a query with its handler, then the read model whole', async () => {
    const store = await readModelDataSet();
    expect((await runCommand(store, REMOVE_READER, { id: 'TL-LEND-RM01-RD' })).changes.map((c) => c.table)).toEqual(['reader']);
    expect((await runCommand(store, REMOVE_QUERY_HANDLER, { id: 'TL-LEND-QRY01-H' })).changes.map((c) => c.table).sort()).toEqual(['meets', 'query_handler']);
    expect((await runCommand(store, REMOVE_PROJECTION, { id: 'TL-LEND-RM01-PJ' })).changes.map((c) => c.table)).toEqual(['projection']);
    await runCommand(store, ADD_QUERY_HANDLER, { id: 'TL-LEND-QRY01-H', title: 'listCatalog', query_id: 'TL-LEND-QRY01', description: 'Reads it.' });
    expect((await runCommand(store, REMOVE_QUERY, { id: 'TL-LEND-QRY01' })).changes.map((c) => c.table).sort()).toEqual(['query', 'query_handler', 'selects_by']);
    expect(new Set((await runCommand(store, REMOVE_READ_MODEL, { id: 'TL-LEND-RM01' })).changes.map((c) => c.table))).toEqual(new Set(['read_model', 'read_model_field', 'reads', 'calls', 'fed_by']));
  });

  it('refuses to remove a read model while its table stores it, naming the table', async () => {
    const store = await readModelDataSet();
    const data = domainModelBase({ ...AROUND, read_model: store.rows('read_model'), table: [{ id: 'TL-LEND-RM01-TB', title: 'catalog', read_model_id: 'TL-LEND-RM01', name: 'catalog', storage: 'view' }] });
    const referenced = await storeOn(data);
    expect((await refusal(referenced, REMOVE_READ_MODEL, { id: 'TL-LEND-RM01' })).problems[0].message).toBe('Read model TL-LEND-RM01 is referenced, so it stays: table TL-LEND-RM01-TB (read_model_id)');
  });
});
