import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EventTypeRow } from '../../../platform/data/tables.ts';
import { DomainEventRepository } from '../repository.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import { oneEventType } from '../rules.ts';
import { ADD_EVENT_TYPE_IDENTITY } from './identities.generated.ts';

export type AddEventType = Pick<EventTypeRow, 'id' | 'title' | 'domain_event_id' | 'delivery' | 'file'> & { meets?: string[]; packages?: string[] };

export const ADD_EVENT_TYPE = {
  ...ADD_EVENT_TYPE_IDENTITY,
  input: {
    id: column('event_type', 'id', 'required'),
    title: column('event_type', 'title', 'required'),
    domain_event_id: column('event_type', 'domain_event_id', 'required'),
    delivery: column('event_type', 'delivery', 'optional'),
    file: column('event_type', 'file', 'optional'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts('The packages it uses, each listed in one of the product\'s package.json files.', 'optional'),
  },
  handler: addEventType,
} satisfies CommandDefinition<AddEventType>;

/** Adds the event type to its event, refused when the event has one. */
export function addEventType(tx: Transaction, input: AddEventType): void {
  const events = new DomainEventRepository(tx);
  const event = events.loadHolding('domain_event', input.domain_event_id) ?? tx.refuse('missing', `there is no domain event ${input.domain_event_id}`);
  const { meets = [], packages = [], ...row } = input;
  refuseBroken(oneEventType([...(event.eventType ? [event.eventType.row] : []), row]));
  event.eventType = { row, meets, packages };
  events.save(event);
}
