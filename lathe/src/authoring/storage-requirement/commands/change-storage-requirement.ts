import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { StorageRequirementRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { StorageRequirementRepository } from '../repository.ts';
import { CHANGE_STORAGE_REQUIREMENT_IDENTITY } from './identities.generated.ts';

/** The storage requirement's changes: a column given is set. */
export type ChangeStorageRequirement = Pick<StorageRequirementRow, 'id'> & { title?: StorageRequirementRow['title']; statement?: StorageRequirementRow['statement'] };

export const CHANGE_STORAGE_REQUIREMENT = {
  ...CHANGE_STORAGE_REQUIREMENT_IDENTITY,
  input: {
    id: column('storage_requirement', 'id', 'required'),
    title: column('storage_requirement', 'title', 'optional'),
    statement: column('storage_requirement', 'statement', 'optional'),
  },
  handler: changeStorageRequirement,
} satisfies CommandDefinition<ChangeStorageRequirement>;

/** Changes the storage requirement's columns. */
export function changeStorageRequirement(tx: Transaction, input: ChangeStorageRequirement): void {
  const requirements = new StorageRequirementRepository(tx);
  const requirement = requirements.load(input.id) ?? tx.refuse('missing', `there is no storage requirement ${input.id}`);
  requirement.requirement = changed(requirement.requirement, input, ['title', 'statement']);
  requirements.save(requirement);
}
