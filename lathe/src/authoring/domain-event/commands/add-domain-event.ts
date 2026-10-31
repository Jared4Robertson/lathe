import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DomainEventRow } from '../../../platform/data/tables.ts';
import { DOMAIN_EVENT_SLICE, newDomainEvent, type EventFieldInput } from '../model.ts';
import { DomainEventRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export type AddDomainEvent = Pick<DomainEventRow, 'id' | 'title' | 'aggregate_id' | 'published' | 'description'> & { fields?: EventFieldInput[] };

export const ADD_DOMAIN_EVENT: CommandDefinition<AddDomainEvent> = {
  id: 'LA-AUT-CMD230',
  slice: DOMAIN_EVENT_SLICE,
  name: 'add-domain-event',
  description: 'Adds a domain event to the aggregate it happens to, with the fields it carries, in order.',
  method: 'POST',
  route: '/api/domain-event/add-domain-event',
  input: {
    id: column('domain_event', 'id', 'required'),
    title: column('domain_event', 'title', 'required'),
    aggregate_id: column('domain_event', 'aggregate_id', 'required'),
    published: column('domain_event', 'published', 'required'),
    description: column('domain_event', 'description', 'required'),
    fields: parts('event_field', ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'], 'The fields it carries, in order: each its name, meaning, one type (a basic type, a value object or an aggregate), whether it is required, and its column name and an example when it has them.', 'optional'),
  },
  handler: addDomainEvent,
};

export function addDomainEvent(tx: Transaction, input: AddDomainEvent): void {
  const events = new DomainEventRepository(tx);
  const { fields = [], ...row } = input;
  const event = events.create(newDomainEvent(row, fields));
  holdToRules(tx, event);
  events.save(event);
}
