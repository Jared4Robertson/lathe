import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { StorageRequirementRow } from '../../../platform/data/tables.ts';
import { newStorageRequirement } from '../model.ts';
import { StorageRequirementRepository } from '../repository.ts';
import { ADD_STORAGE_REQUIREMENT_IDENTITY } from './identities.generated.ts';

export type AddStorageRequirement = Pick<StorageRequirementRow, 'id' | 'title' | 'aggregate_id' | 'read_model_id' | 'statement'>;

export const ADD_STORAGE_REQUIREMENT = {
  ...ADD_STORAGE_REQUIREMENT_IDENTITY,
  input: {
    id: column('storage_requirement', 'id', 'required'),
    title: column('storage_requirement', 'title', 'required'),
    aggregate_id: column('storage_requirement', 'aggregate_id', 'optional'),
    read_model_id: column('storage_requirement', 'read_model_id', 'optional'),
    statement: column('storage_requirement', 'statement', 'required'),
  },
  handler: addStorageRequirement,
} satisfies CommandDefinition<AddStorageRequirement>;

export function addStorageRequirement(tx: Transaction, input: AddStorageRequirement): void {
  const requirements = new StorageRequirementRepository(tx);
  if ((input.aggregate_id === undefined) === (input.read_model_id === undefined)) {
    tx.refuse('parent', `storage requirement ${input.id} sits under exactly one aggregate or read model: give exactly one of aggregate_id and read_model_id`);
  }
  const requirement = requirements.create(newStorageRequirement(input));
  requirements.save(requirement);
}
