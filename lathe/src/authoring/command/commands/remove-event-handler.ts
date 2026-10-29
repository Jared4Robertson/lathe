// Remove an event handler (LA-AUT-CMD251): Removes an event handler with the links it starts and the packages it uses. Refused while anything else references it.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { COMMAND_SLICE } from '../model.ts';
import { CommandRepository } from '../repository.ts';

/** The event handler to remove. */
export type RemoveEventHandler = { id: string };

/** Remove an event handler (LA-AUT-CMD251). */
export const REMOVE_EVENT_HANDLER: CommandDefinition<RemoveEventHandler> = {
  id: 'LA-AUT-CMD251',
  slice: COMMAND_SLICE,
  name: 'remove-event-handler',
  description: 'Removes an event handler with the links it starts and the packages it uses. Refused while anything else references it.',
  method: 'POST',
  route: '/api/command/remove-event-handler',
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
