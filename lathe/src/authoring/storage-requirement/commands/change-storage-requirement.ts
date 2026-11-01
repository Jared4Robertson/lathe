import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { StorageRequirementRow } from '../../../platform/data/tables.ts';
import { CHANGE_STORAGE_REQUIREMENT_IDENTITY } from './identities.generated.ts';
import { changeStorageRequirement } from './handlers.generated.ts';

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
