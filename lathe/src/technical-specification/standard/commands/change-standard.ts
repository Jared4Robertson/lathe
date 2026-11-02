import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { StandardRow } from '../../../platform/data/tables.ts';
import { CHANGE_STANDARD_IDENTITY } from './identities.generated.ts';
import { changeStandard } from './handlers.generated.ts';

/** The standard's changes: a column given is set. */
export type ChangeStandard = Pick<StandardRow, 'id'> & { title?: StandardRow['title']; type?: StandardRow['type']; description?: StandardRow['description'] };

export const CHANGE_STANDARD = {
  ...CHANGE_STANDARD_IDENTITY,
  input: {
    id: column('standard', 'id', 'required'),
    title: column('standard', 'title', 'optional'),
    type: column('standard', 'type', 'optional'),
    description: column('standard', 'description', 'optional'),
  },
  handler: changeStandard,
} satisfies CommandDefinition<ChangeStandard>;
