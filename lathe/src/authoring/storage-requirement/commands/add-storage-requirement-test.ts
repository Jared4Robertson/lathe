// Add a storage requirement test (LA-AUT-CMD363): Adds a storage requirement test under its storage requirement, with the test data sets it starts from.
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { StorageRequirementTestRow } from '../../../platform/data/tables.ts';
import { STORAGE_REQUIREMENT_SLICE } from '../model.ts';
import { StorageRequirementRepository } from '../repository.ts';

/** A new storage requirement test, with the links it starts. */
export type AddStorageRequirementTest = Pick<StorageRequirementTestRow, 'id' | 'title' | 'storage_requirement_id' | 'level' | 'state' | 'when' | 'then' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'notes'> & { starts_from?: string[] };

/** Add a storage requirement test (LA-AUT-CMD363). */
export const ADD_STORAGE_REQUIREMENT_TEST: CommandDefinition<AddStorageRequirementTest> = {
  id: 'LA-AUT-CMD363',
  slice: STORAGE_REQUIREMENT_SLICE,
  name: 'add-storage-requirement-test',
  description: 'Adds a storage requirement test under its storage requirement, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/storage-requirement/add-storage-requirement-test',
  input: {
    id: column('storage_requirement_test', 'id', 'required'),
    title: column('storage_requirement_test', 'title', 'required'),
    storage_requirement_id: column('storage_requirement_test', 'storage_requirement_id', 'required'),
    level: column('storage_requirement_test', 'level', 'required'),
    state: column('storage_requirement_test', 'state', 'required'),
    when: column('storage_requirement_test', 'when', 'required'),
    then: column('storage_requirement_test', 'then', 'required'),
    file: column('storage_requirement_test', 'file', 'optional'),
    manual_reason: column('storage_requirement_test', 'manual_reason', 'optional'),
    size: column('storage_requirement_test', 'size', 'optional'),
    smoke: column('storage_requirement_test', 'smoke', 'optional'),
    external: column('storage_requirement_test', 'external', 'optional'),
    notes: column('storage_requirement_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addStorageRequirementTest,
};

/** Adds the storage requirement test under its storage requirement, with its links. */
export function addStorageRequirementTest(tx: Transaction, input: AddStorageRequirementTest): void {
  const requirements = new StorageRequirementRepository(tx);
  const requirement = requirements.load(input.storage_requirement_id) ?? tx.refuse('missing', `there is no storage requirement ${input.storage_requirement_id}`);
  const { starts_from = [], ...row } = input;
  requirement.tests.push({ row, startsFrom: starts_from });
  requirements.save(requirement);
}
