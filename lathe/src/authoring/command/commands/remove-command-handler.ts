import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { COMMAND_SLICE } from '../model.ts';
import { CommandRepository } from '../repository.ts';

/** The handler to remove. */
export type RemoveCommandHandler = { id: string };

export const REMOVE_COMMAND_HANDLER: CommandDefinition<RemoveCommandHandler> = {
  id: 'LA-AUT-CMD245',
  slice: COMMAND_SLICE,
  name: 'remove-command-handler',
  description: 'Removes a command handler with the links it starts and the packages it uses. Refused while anything else references it.',
  method: 'POST',
  route: '/api/command/remove-command-handler',
  input: {
    id: column('command_handler', 'id', 'required'),
  },
  handler: removeCommandHandler,
};

/** Removes the handler from its command. */
export function removeCommandHandler(tx: Transaction, input: RemoveCommandHandler): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('command_handler', input.id) ?? tx.refuse('missing', `there is no command handler ${input.id}`);
  command.handler = null;
  commands.save(command);
}
