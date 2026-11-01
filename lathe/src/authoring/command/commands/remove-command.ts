import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { CommandRepository } from '../repository.ts';
import { REMOVE_COMMAND_IDENTITY } from './identities.generated.ts';

/** The command to remove. */
export type RemoveCommand = { id: string };

export const REMOVE_COMMAND: CommandDefinition<RemoveCommand> = {
  ...REMOVE_COMMAND_IDENTITY,
  input: {
    id: column('command', 'id', 'required'),
  },
  handler: removeCommand,
};

/** Removes the command whole. */
export function removeCommand(tx: Transaction, input: RemoveCommand): void {
  const commands = new CommandRepository(tx);
  const command = commands.load(input.id) ?? tx.refuse('missing', `there is no command ${input.id}`);
  commands.remove(command);
}
