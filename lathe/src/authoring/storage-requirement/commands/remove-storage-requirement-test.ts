// Remove a storage requirement test (LA-AUT-CMD365): Removes a storage requirement test with the links it starts. Refused while anything references it, such as a business outcome it measures.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { STORAGE_REQUIREMENT_SLICE } from '../model.ts';
import { StorageRequirementRepository } from '../repository.ts';

/** The storage requirement test to remove. */
export type RemoveStorageRequirementTest = { id: string };

/** Remove a storage requirement test (LA-AUT-CMD365). */
export const REMOVE_STORAGE_REQUIREMENT_TEST: CommandDefinition<RemoveStorageRequirementTest> = {
  id: 'LA-AUT-CMD365',
  slice: STORAGE_REQUIREMENT_SLICE,
  name: 'remove-storage-requirement-test',
  description: 'Removes a storage requirement test with the links it starts. Refused while anything references it, such as a business outcome it measures.',
  method: 'POST',
  route: '/api/storage-requirement/remove-storage-requirement-test',
  input: {
    id: column('storage_requirement_test', 'id', 'required'),
  },
  handler: removeStorageRequirementTest,
};

/** Removes the test from its storage requirement. */
export function removeStorageRequirementTest(tx: Transaction, input: RemoveStorageRequirementTest): void {
  const requirements = new StorageRequirementRepository(tx);
  const requirement = requirements.loadHolding('storage_requirement_test', input.id) ?? tx.refuse('missing', `there is no storage requirement test ${input.id}`);
  requirement.tests = requirement.tests.filter((t) => t.row.id !== input.id);
  requirements.save(requirement);
}
