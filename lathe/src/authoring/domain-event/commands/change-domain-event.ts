import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DomainEventRow } from '../../../platform/data/tables.ts';
import { changed, fieldRows, type EventFieldInput } from '../model.ts';
import { DomainEventRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_DOMAIN_EVENT_IDENTITY } from './identities.generated.ts';

/** The event's changes: a column given is set; fields, when given, replace the list. */
export type ChangeDomainEvent = Pick<DomainEventRow, 'id'> & { title?: string; published?: boolean; description?: string; fields?: EventFieldInput[] };

export const CHANGE_DOMAIN_EVENT = {
  ...CHANGE_DOMAIN_EVENT_IDENTITY,
  input: {
    id: column('domain_event', 'id', 'required'),
    title: column('domain_event', 'title', 'optional'),
    published: column('domain_event', 'published', 'optional'),
    description: column('domain_event', 'description', 'optional'),
    fields: parts('event_field', ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'], 'The fields it carries, in order. Replaces the list.', 'optional'),
  },
  handler: changeDomainEvent,
} satisfies CommandDefinition<ChangeDomainEvent>;

/** Changes the event's columns and fields. */
export function changeDomainEvent(tx: Transaction, input: ChangeDomainEvent): void {
  const events = new DomainEventRepository(tx);
  const event = events.load(input.id) ?? tx.refuse('missing', `there is no domain event ${input.id}`);
  event.event = changed(event.event, input, ['title', 'published', 'description']);
  if (input.fields) event.fields = fieldRows(input.id, input.fields);
  holdToRules(tx, event);
  events.save(event);
}
