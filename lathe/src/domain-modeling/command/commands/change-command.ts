import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { CommandRow } from '../../../platform/data/tables.ts';
import { CHANGE_COMMAND_IDENTITY } from './identities.generated.ts';
import { changeCommand } from './handlers.generated.ts';

/** The command's changes: a column given is set; a list given replaces its list. */
export type ChangeCommand = Pick<CommandRow, 'id'> & { title?: string; description?: string; raises?: string[]; checks?: string[]; calls?: string[] };

export const CHANGE_COMMAND = {
  ...CHANGE_COMMAND_IDENTITY,
  input: {
    id: column('command', 'id', 'required'),
    title: column('command', 'title', 'optional'),
    description: column('command', 'description', 'optional'),
    raises: ids('The events of its aggregate it raises. Replaces the list.', 'optional'),
    checks: ids('The specifications of its domain it checks before it acts. Replaces the list.', 'optional'),
    calls: ids('The domain services of its domain it calls. Replaces the list.', 'optional'),
  },
  handler: changeCommand,
} satisfies CommandDefinition<ChangeCommand>;
