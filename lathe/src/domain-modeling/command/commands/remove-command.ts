import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_COMMAND_IDENTITY } from './identities.generated.ts';
import { removeCommand } from './handlers.generated.ts';

/** The command to remove. */
export type RemoveCommand = { id: string };

export const REMOVE_COMMAND = {
  ...REMOVE_COMMAND_IDENTITY,
  input: {
    id: column('command', 'id', 'required'),
  },
  handler: removeCommand,
} satisfies CommandDefinition<RemoveCommand>;
