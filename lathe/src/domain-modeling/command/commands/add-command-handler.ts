import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { CommandHandlerRow } from '../../../platform/data/tables.ts';
import { ADD_COMMAND_HANDLER_IDENTITY } from './identities.generated.ts';
import { addCommandHandler } from './handlers.generated.ts';

export type AddCommandHandler = Pick<CommandHandlerRow, 'id' | 'title' | 'command_id' | 'file' | 'description'> & { meets?: string[]; packages?: string[] };

export const ADD_COMMAND_HANDLER = {
  ...ADD_COMMAND_HANDLER_IDENTITY,
  input: {
    id: column('command_handler', 'id', 'required'),
    title: column('command_handler', 'title', 'required'),
    command_id: column('command_handler', 'command_id', 'required'),
    file: column('command_handler', 'file', 'optional'),
    description: column('command_handler', 'description', 'required'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts('The packages it uses, each listed in one of the product\'s package.json files.', 'optional'),
  },
  handler: addCommandHandler,
} satisfies CommandDefinition<AddCommandHandler>;
