import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { UcRequirementRow } from '../../../platform/data/tables.ts';
import { ADD_UC_REQUIREMENT_IDENTITY } from './identities.generated.ts';
import { addUcRequirement } from './handlers.generated.ts';

/** A new UC requirement. */
export type AddUcRequirement = Pick<UcRequirementRow, 'id' | 'title' | 'use_case_id' | 'statement' | 'group_name'>;

export const ADD_UC_REQUIREMENT = {
  ...ADD_UC_REQUIREMENT_IDENTITY,
  input: {
    id: column('uc_requirement', 'id', 'required'),
    title: column('uc_requirement', 'title', 'required'),
    use_case_id: column('uc_requirement', 'use_case_id', 'required'),
    statement: column('uc_requirement', 'statement', 'required'),
    group_name: column('uc_requirement', 'group_name', 'optional'),
  },
  handler: addUcRequirement,
} satisfies CommandDefinition<AddUcRequirement>;
