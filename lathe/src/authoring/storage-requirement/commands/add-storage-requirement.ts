// Add a storage requirement (LA-AUT-CMD360): Adds a storage requirement under the one aggregate or read model whose data it is about (exactly one of aggregate_id and read_model_id): what of it must be kept, and how well.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { StorageRequirementRow } from '../../../platform/data/tables.ts';
import { STORAGE_REQUIREMENT_SLICE, newStorageRequirement } from '../model.ts';
import { StorageRequirementRepository } from '../repository.ts';

/** A new storage requirement, under one parent. */
export type AddStorageRequirement = Pick<StorageRequirementRow, 'id' | 'title' | 'aggregate_id' | 'read_model_id' | 'statement'>;

/** Add a storage requirement (LA-AUT-CMD360). */
export const ADD_STORAGE_REQUIREMENT: CommandDefinition<AddStorageRequirement> = {
  id: 'LA-AUT-CMD360',
  slice: STORAGE_REQUIREMENT_SLICE,
  name: 'add-storage-requirement',
  description: 'Adds a storage requirement under the one aggregate or read model whose data it is about (exactly one of aggregate_id and read_model_id): what of it must be kept, and how well.',
  method: 'POST',
  route: '/api/storage-requirement/add-storage-requirement',
  input: {
    id: column('storage_requirement', 'id', 'required'),
    title: column('storage_requirement', 'title', 'required'),
    aggregate_id: column('storage_requirement', 'aggregate_id', 'optional'),
    read_model_id: column('storage_requirement', 'read_model_id', 'optional'),
    statement: column('storage_requirement', 'statement', 'required'),
  },
  handler: addStorageRequirement,
};

/** Adds the storage requirement, new and whole, under its one parent. */
export function addStorageRequirement(tx: Transaction, input: AddStorageRequirement): void {
  const requirements = new StorageRequirementRepository(tx);
  if ((input.aggregate_id === undefined) === (input.read_model_id === undefined)) {
    tx.refuse('parent', `storage requirement ${input.id} sits under exactly one aggregate or read model: give exactly one of aggregate_id and read_model_id`);
  }
  const requirement = requirements.create(newStorageRequirement(input));
  requirements.save(requirement);
}
