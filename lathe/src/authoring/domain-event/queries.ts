// The Domain event aggregate's own reads (read model LA-AUT-RM27): a domain event whole, the events of an aggregate,
// and the next free ID for a record of one of its kinds. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { DOMAIN_EVENT_KINDS, DOMAIN_EVENT_SLICE, domainEventsFrom, type DomainEvent, type DomainEventKind } from './model.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The domain event that holds the record: the event itself, or its event type. */
export function getDomainEvent(view: ReadView, input: { id: string }): DomainEvent {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (!(record.kind in DOMAIN_EVENT_KINDS)) refuse('kind', `${input.id} is ${/^[aeiou]/.test(record.kind) ? 'an' : 'a'} ${record.kind}, not a domain event or its event type`);
  const root = record.kind === 'domain_event' ? input.id : String(record.row.domain_event_id);
  return domainEventsFrom((table) => view.rows(table), root)[0];
}

/** GET a domain event whole (LA-AUT-QRY155). */
export const GET_DOMAIN_EVENT: QueryDefinition<{ id: string }, DomainEvent> = {
  id: 'LA-AUT-QRY155',
  slice: DOMAIN_EVENT_SLICE,
  name: 'get-domain-event',
  description: 'Reads a domain event whole, by its ID or its event type\'s: its row, the fields it carries in order, and its event type with the standard rules it meets and the packages it uses.',
  method: 'GET',
  route: '/api/domain-event/get-domain-event',
  input: { id: id('The domain event, or its event type.', 'required') },
  run: getDomainEvent,
  text: domainEventText,
};

/** The domain events of an aggregate, by ID. */
export function listDomainEvents(view: ReadView, input: { aggregate_id: string }): { id: string; title: string }[] {
  if (view.record(input.aggregate_id)?.kind !== 'aggregate') refuse('missing', `there is no aggregate ${input.aggregate_id}`);
  return view
    .rows('domain_event')
    .filter((e) => e.aggregate_id === input.aggregate_id)
    .map((e) => ({ id: String(e.id), title: String(e.title) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** List the domain events of an aggregate (LA-AUT-QRY156). */
export const LIST_DOMAIN_EVENTS: QueryDefinition<{ aggregate_id: string }, { id: string; title: string }[]> = {
  id: 'LA-AUT-QRY156',
  slice: DOMAIN_EVENT_SLICE,
  name: 'list-domain-events',
  description: 'Lists the domain events that happen to an aggregate, by ID, with their titles.',
  method: 'GET',
  route: '/api/domain-event/list-domain-events',
  input: { aggregate_id: id('The aggregate.', 'required') },
  run: listDomainEvents,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No domain events.'),
};

/** The kinds of the aggregate, each with the kind of record it sits under. */
const UNDER: Record<DomainEventKind, string> = {
  domain_event: 'aggregate',
  event_type: 'domain_event',
};

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: a domain event's is its aggregate's
 * domain's ID, EV and one past the highest number in use; an event has one event type, whose ID is the event's and ET.
 */
export function nextDomainEventId(view: ReadView, input: { kind: string; parent: string }): string {
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Domain event aggregate; its kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as DomainEventKind;
  const parent = view.record(input.parent);
  if (parent?.kind !== UNDER[kind]) refuse('parent', `a ${kind} sits under ${/^[aeiou]/.test(UNDER[kind]) ? 'an' : 'a'} ${UNDER[kind]}, and ${input.parent} is ${parent ? `a ${parent.kind}` : 'no record'}`);
  if (kind === 'event_type') {
    const typeId = `${input.parent}-ET`;
    if (view.record(typeId)) refuse('exists', `${input.parent} already has its event type, ${typeId}`);
    return typeId;
  }
  const prefix = `${parent!.row.domain_id}-EV`;
  const shape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  let highest = 0;
  for (const row of view.rows('domain_event')) {
    const m = shape.exec(String(row.id));
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

/** Get the next ID for a record of the Domain event aggregate (LA-AUT-QRY157). */
export const NEXT_DOMAIN_EVENT_ID: QueryDefinition<{ kind: string; parent: string }, string> = {
  id: 'LA-AUT-QRY157',
  slice: DOMAIN_EVENT_SLICE,
  name: 'next-id',
  description: 'The next free ID for a domain event (under an aggregate) or its event type (under the event): one past the highest in use.',
  method: 'GET',
  route: '/api/domain-event/next-id',
  input: {
    kind: id('The kind: domain_event or event_type.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  run: nextDomainEventId,
  text: (next) => next,
};

/** A domain event as text: its row, its fields in order, then its event type. */
function domainEventText(event: DomainEvent): string {
  const { event: row } = event;
  const lines = [`Domain event ${row.id}: ${row.title}`, `  aggregate: ${row.aggregate_id}`, `  published: ${row.published}`, `  description: ${row.description}`];
  for (const f of event.fields) {
    const type = f.type ?? f.type_value_object_id ?? f.type_aggregate_id;
    lines.push(`  ${f.position}. ${f.name}: ${type}${f.required ? ', required' : ''}`);
  }
  const type = event.eventType;
  if (type) {
    const extra = [...(type.row.delivery ? [type.row.delivery] : []), ...(type.row.file ? [type.row.file] : []), ...type.meets.map((x) => `meets ${x}`), ...type.packages.map((x) => `uses ${x}`)];
    lines.push(`Event type ${type.row.id}: ${type.row.title}${extra.length ? ` [${extra.join('; ')}]` : ''}`);
  }
  return lines.join('\n');
}

/** The Domain event aggregate's queries, as the CLI and the MCP server register them. */
export const DOMAIN_EVENT_QUERIES: readonly AnyQuery[] = [GET_DOMAIN_EVENT, LIST_DOMAIN_EVENTS, NEXT_DOMAIN_EVENT_ID];
