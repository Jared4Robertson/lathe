// Remove an event type (LA-AUT-CMD235): Removes an event type with the links it starts and the packages it uses. Refused while anything else references it.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DOMAIN_EVENT_SLICE } from '../model.ts';
import { DomainEventRepository } from '../repository.ts';

/** The event type to remove. */
export type RemoveEventType = { id: string };

/** Remove an event type (LA-AUT-CMD235). */
export const REMOVE_EVENT_TYPE: CommandDefinition<RemoveEventType> = {
  id: 'LA-AUT-CMD235',
  slice: DOMAIN_EVENT_SLICE,
  name: 'remove-event-type',
  description: 'Removes an event type with the links it starts and the packages it uses. Refused while anything else references it.',
  method: 'POST',
  route: '/api/domain-event/remove-event-type',
  input: {
    id: column('event_type', 'id', 'required'),
  },
  handler: removeEventType,
};

/** Removes the event type from its event. */
export function removeEventType(tx: Transaction, input: RemoveEventType): void {
  const events = new DomainEventRepository(tx);
  const event = events.loadHolding('event_type', input.id) ?? tx.refuse('missing', `there is no event type ${input.id}`);
  event.eventType = null;
  events.save(event);
}
