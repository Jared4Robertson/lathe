import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DomainEventRepository } from '../repository.ts';
import { REMOVE_EVENT_TYPE_IDENTITY } from './identities.generated.ts';

/** The event type to remove. */
export type RemoveEventType = { id: string };

export const REMOVE_EVENT_TYPE: CommandDefinition<RemoveEventType> = {
  ...REMOVE_EVENT_TYPE_IDENTITY,
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
