// The Domain event aggregate's read model (LA-MOD-RM27), shaped for its readers: the Domain event page reads an event
// whole (the fields it carries in order, its event type with the standard rules it meets and the packages it uses, the
// commands that raise it and the policies that hear it) with the record the page is about, an aggregate's list reads
// each event's ID and title, and the editor's next ID reads the IDs in use. The projection (domainEventTableFrom) is the
// only code that reads the source rows and the only code that writes the read model's table; the query handlers read
// that table only through the reader (reader.ts). Nothing here is the aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { DomainEventRow, EventFieldRow, EventTypeRow } from '../../platform/data/tables.ts';
import type { DomainEventKind } from './model.ts';
import { compareIds } from '../../platform/data/ids.ts';

/** An event type as the page shows it: its row, the standard rules it meets and the packages it uses. */
export interface EventTypeOnPage {
  eventType: EventTypeRow;
  meets: string[];
  packages: string[];
}

/** A domain event whole, as its page shows it. */
export interface DomainEventTree {
  event: DomainEventRow;
  /** The fields it carries, by position. */
  fields: EventFieldRow[];
  /** Its shape in code, when it has one. */
  eventType: EventTypeOnPage | null;
  /** The commands that raise it, by ID. */
  raisedBy: string[];
  /** The policies that hear it, by ID. */
  heardBy: string[];
}

/** A domain event as its page reads it, with the record of it the page is about. */
export interface DomainEventPage extends DomainEventTree {
  record: { id: string; kind: DomainEventKind };
}

/** A domain event as an aggregate's list reads it. */
export interface DomainEventSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface DomainEventTable {
  /** Each domain event whole, by its ID. */
  events: Map<string, DomainEventTree>;
  /** Each record inside an event: the event that holds it and its kind there. */
  holding: Map<string, { root: string; kind: DomainEventKind }>;
  /** Each aggregate's domain events, by ID, and the domain it sits under; an aggregate with none has an empty list. */
  aggregates: Map<string, { domain: string; events: DomainEventSummary[] }>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/** Rows by a column's value, each list in the table's order. */
function grouped<T>(rows: Row[], column: string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) found.set(String(r[column]), [...(found.get(String(r[column])) ?? []), r as unknown as T]);
  return found;
}

/** A link table's sources or targets, by the other end, each list sorted. */
function linked(view: ReadView, table: string, by: string, to: string): (id: string) => string[] {
  const found = grouped<Row>(view.rows(table), by);
  return (id) => (found.get(id) ?? []).map((l) => String(l[to])).sort(compareIds);
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function domainEventTableFrom(view: ReadView): DomainEventTable {
  const meets = linked(view, 'meets', 'source_id', 'target_id');
  const packages = linked(view, 'package_use', 'record_id', 'package');
  const raisedBy = linked(view, 'raises', 'target_id', 'source_id');
  const heardBy = linked(view, 'hears', 'target_id', 'source_id');
  const fields = grouped<EventFieldRow>(view.rows('event_field'), 'domain_event_id');
  const types = grouped<EventTypeRow>(view.rows('event_type'), 'domain_event_id');

  const events = new Map<string, DomainEventTree>();
  const holding = new Map<string, { root: string; kind: DomainEventKind }>();
  const aggregates = new Map<string, { domain: string; events: DomainEventSummary[] }>(view.rows('aggregate').map((a) => [String(a.id), { domain: String(a.domain_id), events: [] }]));
  for (const event of view.rows('domain_event') as unknown as DomainEventRow[]) {
    const root = event.id;
    holding.set(root, { root, kind: 'domain_event' });
    const type = (types.get(root) ?? [])[0];
    if (type) holding.set(type.id, { root, kind: 'event_type' });
    events.set(root, {
      event,
      fields: [...(fields.get(root) ?? [])].sort((a, b) => a.position - b.position),
      eventType: type ? { eventType: type, meets: meets(type.id), packages: packages(type.id) } : null,
      raisedBy: raisedBy(root),
      heardBy: heardBy(root),
    });
    aggregates.get(event.aggregate_id)?.events.push({ id: event.id, title: event.title });
  }
  for (const a of aggregates.values()) a.events.sort((x, y) => compareIds(x.id, y.id));
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { events, holding, aggregates, kinds };
}
