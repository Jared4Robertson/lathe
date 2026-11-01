import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { CommandRepository } from '../repository.ts';
import { REMOVE_COMMAND_HANDLER_IDENTITY } from './identities.generated.ts';

/** The handler to remove. */
export type RemoveCommandHandler = { id: string };

export const REMOVE_COMMAND_HANDLER = {
  ...REMOVE_COMMAND_HANDLER_IDENTITY,
  input: {
    id: column('command_handler', 'id', 'required'),
  },
  handler: removeCommandHandler,
} satisfies CommandDefinition<RemoveCommandHandler>;

/** Removes the handler from its command. */
export function removeCommandHandler(tx: Transaction, input: RemoveCommandHandler): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('command_handler', input.id) ?? tx.refuse('missing', `there is no command handler ${input.id}`);
  command.handler = null;
  commands.save(command);
}
