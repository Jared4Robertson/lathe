// Change a domain event (LA-AUT-CMD231): Changes a domain event's title, description or whether it is published, or its fields (the whole list, in order). The aggregate it happens to does not change.
import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DomainEventRow } from '../../../platform/data/tables.ts';
import { changed, DOMAIN_EVENT_SLICE, fieldRows, type EventFieldInput } from '../model.ts';
import { DomainEventRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The event's changes: a column given is set; fields, when given, replace the list. */
export type ChangeDomainEvent = Pick<DomainEventRow, 'id'> & { title?: string; published?: boolean; description?: string; fields?: EventFieldInput[] };

/** Change a domain event (LA-AUT-CMD231). */
export const CHANGE_DOMAIN_EVENT: CommandDefinition<ChangeDomainEvent> = {
  id: 'LA-AUT-CMD231',
  slice: DOMAIN_EVENT_SLICE,
  name: 'change-domain-event',
  description: "Changes a domain event's title, description or whether it is published, or its fields (the whole list, in order). The aggregate it happens to does not change.",
  method: 'POST',
  route: '/api/domain-event/change-domain-event',
  input: {
    id: column('domain_event', 'id', 'required'),
    title: column('domain_event', 'title', 'optional'),
    published: column('domain_event', 'published', 'optional'),
    description: column('domain_event', 'description', 'optional'),
    fields: parts('event_field', ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'], 'The fields it carries, in order. Replaces the list.', 'optional'),
  },
  handler: changeDomainEvent,
};

/** Changes the event's columns and fields. */
export function changeDomainEvent(tx: Transaction, input: ChangeDomainEvent): void {
  const events = new DomainEventRepository(tx);
  const event = events.load(input.id) ?? tx.refuse('missing', `there is no domain event ${input.id}`);
  event.event = changed(event.event, input, ['title', 'published', 'description']);
  if (input.fields) event.fields = fieldRows(input.id, input.fields);
  holdToRules(tx, event);
  events.save(event);
}
