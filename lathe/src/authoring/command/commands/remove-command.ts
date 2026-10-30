// Remove a command (LA-AUT-CMD242): Removes a command whole: its handler, its policies with their event handlers and tests, and the links they start. Refused while anything outside it references what is in it: a step that invokes it, its endpoint or CLI command.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { COMMAND_SLICE } from '../model.ts';
import { CommandRepository } from '../repository.ts';

/** The command to remove. */
export type RemoveCommand = { id: string };

/** Remove a command (LA-AUT-CMD242). */
export const REMOVE_COMMAND: CommandDefinition<RemoveCommand> = {
  id: 'LA-AUT-CMD242',
  slice: COMMAND_SLICE,
  name: 'remove-command',
  description: 'Removes a command whole: its handler, its policies with their event handlers and tests, and the links they start. Refused while anything outside it references what is in it: a step that invokes it, its endpoint or CLI command.',
  method: 'POST',
  route: '/api/command/remove-command',
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
