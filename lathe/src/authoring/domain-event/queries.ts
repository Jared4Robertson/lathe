// The Domain event aggregate's own reads, each answered from its read model (LA-AUT-RM27) through its reader
// (reader.ts), which the query runner gives each handler: a domain event whole as its page reads it, the events of an
// aggregate, and the next free ID for a record of one of its kinds. A handler never sees the data, a repository or the
// aggregate's model; each changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { DOMAIN_EVENT_SLICE, type DomainEventKind } from './model.ts';
import type { DomainEventPage, DomainEventSummary } from './read-model.ts';
import { domainEventReader, type DomainEventReader } from './reader.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (word: string) => (/^[aeiou]/.test(word) ? 'an' : 'a');

/** The domain event that holds the record, as its page reads it: the event itself, or its event type. */
export function getDomainEvent(reader: DomainEventReader, input: { id: string }): DomainEventPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not a domain event or its event type`);
}

/** GET a domain event whole (LA-AUT-QRY155). */
export const GET_DOMAIN_EVENT: QueryDefinition<{ id: string }, DomainEventPage, DomainEventReader> = {
  id: 'LA-AUT-QRY155',
  slice: DOMAIN_EVENT_SLICE,
  name: 'get-domain-event',
  description: 'Reads a domain event whole as its page shows it, by its ID or its event type\'s: the record asked for and its kind, the event\'s row, the fields it carries in order, its event type with the standard rules it meets and the packages it uses, and the commands that raise it and the policies that hear it.',
  method: 'GET',
  route: '/api/domain-event/get-domain-event',
  input: { id: id('The domain event, or its event type.', 'required') },
  reader: domainEventReader,
  run: getDomainEvent,
  text: domainEventText,
};

/** The domain events of an aggregate, by ID. */
export function listDomainEvents(reader: DomainEventReader, input: { aggregate_id: string }): DomainEventSummary[] {
  return reader.eventsOf(input.aggregate_id) ?? refuse('missing', `there is no aggregate ${input.aggregate_id}`);
}

/** List the domain events of an aggregate (LA-AUT-QRY156). */
export const LIST_DOMAIN_EVENTS: QueryDefinition<{ aggregate_id: string }, DomainEventSummary[], DomainEventReader> = {
  id: 'LA-AUT-QRY156',
  slice: DOMAIN_EVENT_SLICE,
  name: 'list-domain-events',
  description: 'Lists the domain events that happen to an aggregate, by ID, with their titles.',
  method: 'GET',
  route: '/api/domain-event/list-domain-events',
  input: { aggregate_id: id('The aggregate.', 'required') },
  reader: domainEventReader,
  run: listDomainEvents,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No domain events.'),
};

/** The kinds of the aggregate with an ID under a parent; how each is written the schema says (`idShape`). */
const KINDS: readonly string[] = ['domain_event', 'event_type'];

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: a domain event's is its aggregate's
 * domain's ID, EV and one past the highest number in use; an event has one event type, whose ID is the event's and ET.
 */
export function nextDomainEventId(reader: DomainEventReader, input: { kind: string; parent: string }): string {
  if (!KINDS.includes(input.kind)) refuse('kind', `${input.kind} is not a kind of the Domain event aggregate; its kinds are ${KINDS.join(', ')}`);
  const kind = input.kind as DomainEventKind;
  const shape = reader.idShape(kind);
  const parentKind = reader.kindOf(input.parent);
  if (parentKind !== shape.parents[0]) refuse('parent', `a ${kind} sits under ${article(shape.parents[0])} ${shape.parents[0]}, and ${input.parent} is ${parentKind ? `${article(parentKind)} ${parentKind}` : 'no record'}`);
  if (kind === 'event_type') {
    const typeId = `${input.parent}-${shape.letters}`;
    if (reader.kindOf(typeId)) refuse('exists', `${input.parent} already has its event type, ${typeId}`);
    return typeId;
  }
  return onePast(reader, `${reader.domainOf(input.parent)}-${shape.letters}`, shape);
}

/** Get the next ID for a record of the Domain event aggregate (LA-AUT-QRY157). */
export const NEXT_DOMAIN_EVENT_ID: QueryDefinition<{ kind: string; parent: string }, string, DomainEventReader> = {
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
  reader: domainEventReader,
  run: nextDomainEventId,
  text: (next) => next,
};

/** A domain event as text: its row, its fields in order, then its event type and what raises and hears it. */
function domainEventText(page: DomainEventPage): string {
  const { event: row } = page;
  const lines = [`Domain event ${row.id}: ${row.title}`, `  aggregate: ${row.aggregate_id}`, `  published: ${row.published}`, `  description: ${row.description}`];
  for (const f of page.fields) {
    const type = f.type ?? f.type_value_object_id ?? f.type_aggregate_id;
    lines.push(`  ${f.position}. ${f.name}: ${type}${f.required ? ', required' : ''}`);
  }
  const type = page.eventType;
  if (type) {
    const extra = [...(type.eventType.delivery ? [type.eventType.delivery] : []), ...(type.eventType.file ? [type.eventType.file] : []), ...type.meets.map((x) => `meets ${x}`), ...type.packages.map((x) => `uses ${x}`)];
    lines.push(`Event type ${type.eventType.id}: ${type.eventType.title}${extra.length ? ` [${extra.join('; ')}]` : ''}`);
  }
  if (page.raisedBy.length) lines.push(`Raised by ${page.raisedBy.join(', ')}`);
  if (page.heardBy.length) lines.push(`Heard by ${page.heardBy.join(', ')}`);
  return lines.join('\n');
}

/** The Domain event aggregate's queries, as the CLI and the MCP server register them. */
export const DOMAIN_EVENT_QUERIES: readonly AnyQuery[] = [GET_DOMAIN_EVENT, LIST_DOMAIN_EVENTS, NEXT_DOMAIN_EVENT_ID];
