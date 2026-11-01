import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { CommandRepository } from '../repository.ts';
import { REMOVE_EVENT_HANDLER_IDENTITY } from './identities.generated.ts';

/** The event handler to remove. */
export type RemoveEventHandler = { id: string };

export const REMOVE_EVENT_HANDLER: CommandDefinition<RemoveEventHandler> = {
  ...REMOVE_EVENT_HANDLER_IDENTITY,
  input: {
    id: column('event_handler', 'id', 'required'),
  },
  handler: removeEventHandler,
};

/** Removes the event handler from its policy. */
export function removeEventHandler(tx: Transaction, input: RemoveEventHandler): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('event_handler', input.id) ?? tx.refuse('missing', `there is no event handler ${input.id}`);
  command.eventHandlers = command.eventHandlers.filter((h) => h.row.id !== input.id);
  commands.save(command);
}
