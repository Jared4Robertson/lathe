import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_COMMAND_HANDLER_IDENTITY } from './identities.generated.ts';
import { removeCommandHandler } from './handlers.generated.ts';

/** The handler to remove. */
export type RemoveCommandHandler = { id: string };

export const REMOVE_COMMAND_HANDLER = {
  ...REMOVE_COMMAND_HANDLER_IDENTITY,
  input: {
    id: column('command_handler', 'id', 'required'),
  },
  handler: removeCommandHandler,
} satisfies CommandDefinition<RemoveCommandHandler>;
