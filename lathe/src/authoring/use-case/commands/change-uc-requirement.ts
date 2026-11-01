import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { UcRequirementRow } from '../../../platform/data/tables.ts';
import { CHANGE_UC_REQUIREMENT_IDENTITY } from './identities.generated.ts';
import { changeUcRequirement } from './handlers.generated.ts';

/** The requirement's changes: a column given is set, null clears an optional one. */
export type ChangeUcRequirement = Pick<UcRequirementRow, 'id'> & { title?: string; statement?: string; group_name?: string | null };

export const CHANGE_UC_REQUIREMENT = {
  ...CHANGE_UC_REQUIREMENT_IDENTITY,
  input: {
    id: column('uc_requirement', 'id', 'required'),
    title: column('uc_requirement', 'title', 'optional'),
    statement: column('uc_requirement', 'statement', 'optional'),
    group_name: column('uc_requirement', 'group_name', 'clearable'),
  },
  handler: changeUcRequirement,
} satisfies CommandDefinition<ChangeUcRequirement>;
