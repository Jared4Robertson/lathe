import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { STORAGE_REQUIREMENT_SLICE } from '../model.ts';
import { StorageRequirementRepository } from '../repository.ts';

/** The storage requirement to remove. */
export type RemoveStorageRequirement = { id: string };

export const REMOVE_STORAGE_REQUIREMENT: CommandDefinition<RemoveStorageRequirement> = {
  id: 'LA-AUT-CMD362',
  slice: STORAGE_REQUIREMENT_SLICE,
  name: 'remove-storage-requirement',
  description: 'Removes a storage requirement whole: its storage requirement tests and the links they start. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/storage-requirement/remove-storage-requirement',
  input: {
    id: column('storage_requirement', 'id', 'required'),
  },
  handler: removeStorageRequirement,
};

/** Removes the storage requirement whole. */
export function removeStorageRequirement(tx: Transaction, input: RemoveStorageRequirement): void {
  const requirements = new StorageRequirementRepository(tx);
  const requirement = requirements.load(input.id) ?? tx.refuse('missing', `there is no storage requirement ${input.id}`);
  requirements.remove(requirement);
}
