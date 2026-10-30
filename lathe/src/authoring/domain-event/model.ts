// The Domain event aggregate (LA-AUT-A7): a domain event with the fields it carries, in order, and its event type
// (with the standard rules it meets and the packages it uses). One instance is one event, whole; it holds only the
// links its own records start.
import type { Slice } from '../../platform/commands/definition.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { DomainEventRow, EventFieldRow, EventTypeRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const DOMAIN_EVENT_AGGREGATE = 'LA-AUT-A7';

/** How the interfaces reach the aggregate's commands: `lathe domain-event`, the domain_event_ tools, /api/domain-event/. */
export const DOMAIN_EVENT_SLICE: Slice = { aggregate: DOMAIN_EVENT_AGGREGATE, name: 'domain-event' };

/**
 * The row with the changes applied: a value sets its column, null clears it, and a column left out keeps its value.
 * Only the columns named in `columns` are taken from the changes.
 */
export function changed<R extends object>(row: R, changes: object, columns: readonly string[]): R {
  const next = { ...row } as Record<string, unknown>;
  for (const [column, value] of Object.entries(changes)) {
    if (!columns.includes(column) || value === undefined) continue;
    if (value === null) delete next[column];
    else next[column] = value as Value;
  }
  return next as R;
}

/** An event field as a command gives it: its event and position come from the event and its place in the list. */
export type EventFieldInput = Omit<EventFieldRow, 'domain_event_id' | 'position'>;

/** A technical record with the standard rules it meets and the packages it uses. */
export interface Built<T> {
  row: T;
  meets: string[];
  packages: string[];
}

/** One domain event, whole. */
export interface DomainEvent {
  /** The event's ID: the instance's root. */
  readonly root: string;
  event: DomainEventRow;
  fields: EventFieldRow[];
  /** Its shape in code, when it has one: an event has at most one event type. */
  eventType: Built<EventTypeRow> | null;
}

/** The tables the Domain event aggregate keeps its rows in: its kinds, its part, and the relations its records start. */
export const DOMAIN_EVENT_TABLES = ['domain_event', 'event_field', 'event_type', 'meets', 'package_use'] as const;

/** The kinds of the aggregate's records, each with the column that names its parent inside the aggregate. */
export const DOMAIN_EVENT_KINDS = {
  domain_event: null,
  event_type: 'domain_event_id',
} as const;

export type DomainEventKind = keyof typeof DOMAIN_EVENT_KINDS;

/** The event's fields as rows, in the order given. */
export function fieldRows(eventId: string, fields: EventFieldInput[]): EventFieldRow[] {
  return fields.map((field, at) => ({ domain_event_id: eventId, position: at + 1, ...field }));
}

/** A new domain event with its fields, with no event type yet. */
export function newDomainEvent(event: DomainEventRow, fields: EventFieldInput[]): DomainEvent {
  return { root: event.id, event, fields: fieldRows(event.id, fields), eventType: null };
}

/** The domain events in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function domainEventsFrom(rows: (table: string) => Row[], only?: string): DomainEvent[] {
  const events = rows('domain_event').filter((r) => only === undefined || r.id === only) as unknown as DomainEventRow[];
  if (!events.length) return [];
  const ids = new Set(events.map((e) => e.id));
  const fields = (rows('event_field') as unknown as EventFieldRow[]).filter((f) => ids.has(f.domain_event_id)).sort((a, b) => a.position - b.position);
  const fieldsOf = groupBy(fields, (f) => f.domain_event_id);
  const typesOf = groupBy((rows('event_type') as unknown as EventTypeRow[]).filter((t) => ids.has(t.domain_event_id)), (t) => t.domain_event_id);
  const meets = bySource(rows('meets'), 'source_id', 'target_id');
  const packages = bySource(rows('package_use'), 'record_id', 'package');
  return events.map((event) => {
    const type = groupOf(typesOf, event.id)[0];
    return {
      root: event.id,
      event,
      fields: groupOf(fieldsOf, event.id),
      eventType: type ? { row: type, meets: meets.get(type.id) ?? [], packages: packages.get(type.id) ?? [] } : null,
    };
  });
}

/** The instance's rows, by table. */
export function domainEventRows(event: DomainEvent): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  const type = event.eventType;
  return new Map<string, Row[]>([
    ['domain_event', [asRow(event.event)]],
    ['event_field', event.fields.map(asRow)],
    ['event_type', type ? [asRow(type.row)] : []],
    ['meets', type ? type.meets.map((target) => ({ source_id: type.row.id, target_id: target })) : []],
    ['package_use', type ? type.packages.map((p) => ({ record_id: type.row.id, package: p })) : []],
  ]);
}

/** The kind of the record with this ID inside the event, or undefined. */
export function kindInside(event: DomainEvent, id: string): DomainEventKind | undefined {
  if (event.root === id) return 'domain_event';
  if (event.eventType?.row.id === id) return 'event_type';
  return undefined;
}
