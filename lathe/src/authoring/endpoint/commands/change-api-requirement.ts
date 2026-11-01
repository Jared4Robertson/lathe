import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ApiRequirementRow } from '../../../platform/data/tables.ts';
import { CHANGE_API_REQUIREMENT_IDENTITY } from './identities.generated.ts';
import { changeApiRequirement } from './handlers.generated.ts';

/** The API requirement's changes: a column given is set, null clears an optional one. */
export type ChangeApiRequirement = Pick<ApiRequirementRow, 'id'> & { title?: ApiRequirementRow['title']; statement?: ApiRequirementRow['statement']; group_name?: ApiRequirementRow['group_name'] | null };

export const CHANGE_API_REQUIREMENT = {
  ...CHANGE_API_REQUIREMENT_IDENTITY,
  input: {
    id: column('api_requirement', 'id', 'required'),
    title: column('api_requirement', 'title', 'optional'),
    statement: column('api_requirement', 'statement', 'optional'),
    group_name: column('api_requirement', 'group_name', 'clearable'),
  },
  handler: changeApiRequirement,
} satisfies CommandDefinition<ChangeApiRequirement>;
