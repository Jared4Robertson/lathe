// The Domain event aggregate (LA-MOD-A7): a domain event with the fields it carries, in order, and its event type
// (with the standard rules it meets and the packages it uses). One instance is one event, whole; it holds only the
// links its own records start.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { DomainEventRow, EventFieldRow, EventTypeRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const DOMAIN_EVENT_AGGREGATE = 'LA-MOD-A7';

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

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const DOMAIN_EVENT_SHAPE = {
  domain_event: { at: 'event', lists: { fields: 'fields' } },
  event_type: { at: 'eventType', one: true, refusedBy: 'oneEventType', lists: { meets: 'meets', packages: 'packages' } },
} as const satisfies AggregateShape;

export type DomainEventKind = keyof typeof DOMAIN_EVENT_SHAPE;

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

