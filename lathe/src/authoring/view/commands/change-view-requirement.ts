import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ViewRequirementRow } from '../../../platform/data/tables.ts';
import { CHANGE_VIEW_REQUIREMENT_IDENTITY } from './identities.generated.ts';
import { changeViewRequirement } from './handlers.generated.ts';

/** The view requirement's changes: a column given is set, null clears an optional one. */
export type ChangeViewRequirement = Pick<ViewRequirementRow, 'id'> & { title?: ViewRequirementRow['title']; statement?: ViewRequirementRow['statement']; group_name?: ViewRequirementRow['group_name'] | null };

export const CHANGE_VIEW_REQUIREMENT = {
  ...CHANGE_VIEW_REQUIREMENT_IDENTITY,
  input: {
    id: column('view_requirement', 'id', 'required'),
    title: column('view_requirement', 'title', 'optional'),
    statement: column('view_requirement', 'statement', 'optional'),
    group_name: column('view_requirement', 'group_name', 'clearable'),
  },
  handler: changeViewRequirement,
} satisfies CommandDefinition<ChangeViewRequirement>;
