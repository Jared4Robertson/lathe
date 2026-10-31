import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DOMAIN_EVENT_SLICE } from '../model.ts';
import { DomainEventRepository } from '../repository.ts';

/** The event to remove. */
export type RemoveDomainEvent = { id: string };

export const REMOVE_DOMAIN_EVENT: CommandDefinition<RemoveDomainEvent> = {
  id: 'LA-AUT-CMD232',
  slice: DOMAIN_EVENT_SLICE,
  name: 'remove-domain-event',
  description: 'Removes a domain event whole: its fields, its event type and the links it starts. Refused while anything else references it: a command that raises it, a policy that hears it or a read model it feeds.',
  method: 'POST',
  route: '/api/domain-event/remove-domain-event',
  input: {
    id: column('domain_event', 'id', 'required'),
  },
  handler: removeDomainEvent,
};

/** Removes the event whole. */
export function removeDomainEvent(tx: Transaction, input: RemoveDomainEvent): void {
  const events = new DomainEventRepository(tx);
  const event = events.load(input.id) ?? tx.refuse('missing', `there is no domain event ${input.id}`);
  events.remove(event);
}
