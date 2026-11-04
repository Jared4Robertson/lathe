// Generated from data/ by `npm run generate`. Do not edit.
// The domain-event commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const DOMAIN_EVENT_FIELDS = {
  '/api/domain-event/add-domain-event': {
    id: { kind: 'column', table: 'domain_event', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'domain_event', column: 'title', required: true, clearable: false },
    aggregate_id: { kind: 'column', table: 'domain_event', column: 'aggregate_id', required: true, clearable: false },
    published: { kind: 'column', table: 'domain_event', column: 'published', required: true, clearable: false },
    description: { kind: 'column', table: 'domain_event', column: 'description', required: true, clearable: false },
    fields: { kind: 'parts', table: 'event_field', columns: ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'], description: 'The fields it carries, in order: each its name, meaning, one type (a basic type, a value object or an aggregate), whether it is required, and its column name and an example when it has them.', required: false, clearable: false },
  },
  '/api/domain-event/change-domain-event': {
    id: { kind: 'column', table: 'domain_event', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'domain_event', column: 'title', required: false, clearable: false },
    published: { kind: 'column', table: 'domain_event', column: 'published', required: false, clearable: false },
    description: { kind: 'column', table: 'domain_event', column: 'description', required: false, clearable: false },
    fields: { kind: 'parts', table: 'event_field', columns: ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'], description: 'The fields it carries, in order.', required: false, clearable: false },
  },
  '/api/domain-event/remove-domain-event': {
    id: { kind: 'column', table: 'domain_event', column: 'id', required: true, clearable: false },
  },
  '/api/domain-event/add-event-type': {
    id: { kind: 'column', table: 'event_type', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'event_type', column: 'title', required: true, clearable: false },
    domain_event_id: { kind: 'column', table: 'event_type', column: 'domain_event_id', required: true, clearable: false },
    delivery: { kind: 'column', table: 'event_type', column: 'delivery', required: false, clearable: false },
    file: { kind: 'column', table: 'event_type', column: 'file', required: false, clearable: false },
    meets: { kind: 'ids', description: 'The standard rules it follows.', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses, each listed in one of the product\'s package.json files.', required: false, clearable: false },
    helpers: { kind: 'texts', description: 'The helper files its code is split across beside its file, such as helpers and build-tag variants, each from the product root; no other record names one.', required: false, clearable: false },
  },
  '/api/domain-event/change-event-type': {
    id: { kind: 'column', table: 'event_type', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'event_type', column: 'title', required: false, clearable: false },
    delivery: { kind: 'column', table: 'event_type', column: 'delivery', required: false, clearable: true },
    file: { kind: 'column', table: 'event_type', column: 'file', required: false, clearable: true },
    meets: { kind: 'ids', description: 'The standard rules it follows.', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses.', required: false, clearable: false },
    helpers: { kind: 'texts', description: 'The helper files its code is split across beside its file, each from the product root.', required: false, clearable: false },
  },
  '/api/domain-event/remove-event-type': {
    id: { kind: 'column', table: 'event_type', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
