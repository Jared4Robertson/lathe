import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { StorageRequirementRepository } from '../repository.ts';
import { REMOVE_STORAGE_REQUIREMENT_IDENTITY } from './identities.generated.ts';

/** The storage requirement to remove. */
export type RemoveStorageRequirement = { id: string };

export const REMOVE_STORAGE_REQUIREMENT = {
  ...REMOVE_STORAGE_REQUIREMENT_IDENTITY,
  input: {
    id: column('storage_requirement', 'id', 'required'),
  },
  handler: removeStorageRequirement,
} satisfies CommandDefinition<RemoveStorageRequirement>;

/** Removes the storage requirement whole. */
export function removeStorageRequirement(tx: Transaction, input: RemoveStorageRequirement): void {
  const requirements = new StorageRequirementRepository(tx);
  const requirement = requirements.load(input.id) ?? tx.refuse('missing', `there is no storage requirement ${input.id}`);
  requirements.remove(requirement);
}
