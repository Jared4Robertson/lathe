import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { CommandHandlerRow } from '../../../platform/data/tables.ts';
import { CHANGE_COMMAND_HANDLER_IDENTITY } from './identities.generated.ts';
import { changeCommandHandler } from './handlers.generated.ts';

/** The handler's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeCommandHandler = Pick<CommandHandlerRow, 'id'> & { title?: string; file?: string | null; description?: string; meets?: string[]; packages?: string[]; helpers?: string[] };

export const CHANGE_COMMAND_HANDLER = {
  ...CHANGE_COMMAND_HANDLER_IDENTITY,
  input: {
    id: column('command_handler', 'id', 'required'),
    title: column('command_handler', 'title', 'optional'),
    file: column('command_handler', 'file', 'clearable'),
    description: column('command_handler', 'description', 'optional'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
    helpers: texts('The helper files its code is split across beside its file, each from the product root. Replaces the list.', 'optional'),
  },
  handler: changeCommandHandler,
} satisfies CommandDefinition<ChangeCommandHandler>;
