import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DomainEventRepository } from '../repository.ts';
import { REMOVE_DOMAIN_EVENT_IDENTITY } from './identities.generated.ts';

/** The event to remove. */
export type RemoveDomainEvent = { id: string };

export const REMOVE_DOMAIN_EVENT = {
  ...REMOVE_DOMAIN_EVENT_IDENTITY,
  input: {
    id: column('domain_event', 'id', 'required'),
  },
  handler: removeDomainEvent,
} satisfies CommandDefinition<RemoveDomainEvent>;

/** Removes the event whole. */
export function removeDomainEvent(tx: Transaction, input: RemoveDomainEvent): void {
  const events = new DomainEventRepository(tx);
  const event = events.load(input.id) ?? tx.refuse('missing', `there is no domain event ${input.id}`);
  events.remove(event);
}
