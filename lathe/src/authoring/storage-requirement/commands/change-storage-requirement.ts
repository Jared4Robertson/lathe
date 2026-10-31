import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { StorageRequirementRow } from '../../../platform/data/tables.ts';
import { STORAGE_REQUIREMENT_SLICE, changed } from '../model.ts';
import { StorageRequirementRepository } from '../repository.ts';

/** The storage requirement's changes: a column given is set. */
export type ChangeStorageRequirement = Pick<StorageRequirementRow, 'id'> & { title?: StorageRequirementRow['title']; statement?: StorageRequirementRow['statement'] };

export const CHANGE_STORAGE_REQUIREMENT: CommandDefinition<ChangeStorageRequirement> = {
  id: 'LA-AUT-CMD361',
  slice: STORAGE_REQUIREMENT_SLICE,
  name: 'change-storage-requirement',
  description: "Changes a storage requirement's title or statement. The aggregate or read model it is about never changes: remove it and add it again under another.",
  method: 'POST',
  route: '/api/storage-requirement/change-storage-requirement',
  input: {
    id: column('storage_requirement', 'id', 'required'),
    title: column('storage_requirement', 'title', 'optional'),
    statement: column('storage_requirement', 'statement', 'optional'),
  },
  handler: changeStorageRequirement,
};

/** Changes the storage requirement's columns. */
export function changeStorageRequirement(tx: Transaction, input: ChangeStorageRequirement): void {
  const requirements = new StorageRequirementRepository(tx);
  const requirement = requirements.load(input.id) ?? tx.refuse('missing', `there is no storage requirement ${input.id}`);
  requirement.requirement = changed(requirement.requirement, input, ['title', 'statement']);
  requirements.save(requirement);
}
