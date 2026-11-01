// The Storage requirement aggregate's commands, queries and refusals (LA-AUT-A22), run on a store as the CLI, the MCP
// tools and the HTTP API run them: each command changes one storage requirement through StorageRequirementRepository
// and is refused with its reason, changing nothing.
import { afterEach, describe, expect, it } from 'vitest';
import { REMOVE_STORAGE_REQUIREMENT } from '../../../src/authoring/storage-requirement/commands/remove-storage-requirement.ts';
import { REMOVE_STORAGE_REQUIREMENT_TEST } from '../../../src/authoring/storage-requirement/commands/remove-storage-requirement-test.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { closeOpenStores } from '../domain-model-base.ts';
import { storageRequirementDataSet } from './data-set.ts';

afterEach(closeOpenStores);

describe('LA-STD-CODE-R07-T70 a storage requirement, or a test in one, is removed with what it holds', () => {
  it('removes a storage requirement test with the links it starts, then the storage requirement whole', async () => {
    const store = await storageRequirementDataSet();
    expect((await runCommand(store, REMOVE_STORAGE_REQUIREMENT_TEST, { id: 'TL-LEND-A1-SR01-T01' })).changes.map((c) => c.table).sort()).toEqual(['starts_from', 'storage_requirement_test']);
    expect((await runCommand(store, REMOVE_STORAGE_REQUIREMENT, { id: 'TL-LEND-A1-SR01' })).changes.map((c) => c.table).sort()).toEqual(['storage_requirement', 'storage_requirement_test']);
  });
});
