import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { DomainEventRow } from '../../../platform/data/tables.ts';
import type { EventFieldInput } from '../model.ts';
import { ADD_DOMAIN_EVENT_IDENTITY } from './identities.generated.ts';
import { addDomainEvent } from './handlers.generated.ts';

export type AddDomainEvent = Pick<DomainEventRow, 'id' | 'title' | 'aggregate_id' | 'published' | 'description'> & { fields?: EventFieldInput[] };

export const ADD_DOMAIN_EVENT = {
  ...ADD_DOMAIN_EVENT_IDENTITY,
  input: {
    id: column('domain_event', 'id', 'required'),
    title: column('domain_event', 'title', 'required'),
    aggregate_id: column('domain_event', 'aggregate_id', 'required'),
    published: column('domain_event', 'published', 'required'),
    description: column('domain_event', 'description', 'required'),
    fields: parts('event_field', ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'], 'The fields it carries, in order: each its name, meaning, one type (a basic type, a value object or an aggregate), whether it is required, and its column name and an example when it has them.', 'optional'),
  },
  handler: addDomainEvent,
} satisfies CommandDefinition<AddDomainEvent>;
