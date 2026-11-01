// The Data store aggregate's commands, queries and refusals (LA-AUT-A23), run on a store as the CLI, the MCP tools and
// the HTTP API run them: each command changes one data store through DataStoreRepository and is refused with its
// reason, changing nothing; a repository, reader or table names its one data store through its own aggregate's
// commands.
import { afterEach, describe, expect, it } from 'vitest';
import { REMOVE_DATA_STORE } from '../../../src/authoring/data-store/commands/remove-data-store.ts';
import { CHANGE_REPOSITORY } from '../../../src/authoring/domain/commands/change-repository.ts';
import { CHANGE_TABLE } from '../../../src/authoring/table/commands/change-table.ts';
import { REMOVE_PROVIDER } from '../../../src/traceability/provision/commands/remove-provider.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { closeOpenStores } from '../domain-model-base.ts';
import { dataStoreDataSet } from './data-set.ts';

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

describe('LA-STD-CODE-R07-T71 a data store nothing is stored in or provides is removed whole', () => {
  it('removes a data store once nothing is stored in it and its provider is removed', async () => {
    const store = await dataStoreDataSet();
    await runCommand(store, CHANGE_REPOSITORY, { id: 'TL-LEND-REPO01', stored_in: null });
    await runCommand(store, CHANGE_TABLE, { id: 'TL-LEND-EN01-TB', stored_in: null });
    expect((await refusal(store, REMOVE_DATA_STORE, { id: 'TL-STORE01' })).problems[0].message).toBe('Data store TL-STORE01 is referenced, so it stays: TL-STORE01 provided by TL-INT01');
    await runCommand(store, REMOVE_PROVIDER, { record_id: 'TL-STORE01' });
    expect((await runCommand(store, REMOVE_DATA_STORE, { id: 'TL-STORE01' })).changes.map((c) => c.table)).toEqual(['data_store']);
  });
});
