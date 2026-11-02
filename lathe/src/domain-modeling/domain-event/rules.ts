// The Domain event aggregate's rules, written once: each command's handler runs them on the rows it would save, and
// every load and commit runs them over all data (domainEventRules, listed in AGGREGATE_RULES).
import { beyondFirst, refuseBroken, type AggregateRules, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { EventFieldRow, EventTypeRow } from '../../platform/data/tables.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { DOMAIN_EVENT_AGGREGATE, domainEventsFrom, type DomainEvent } from './model.ts';

/** Every row that breaks LA-MOD-INV108: a domain event has at most one event type. Each after the first is refused. */
export function oneEventType(eventTypes: readonly EventTypeRow[]): RuleProblem[] {
  return beyondFirst(eventTypes, (r) => r.domain_event_id).map((r) => ({
    rule: 'one-event-type',
    table: 'event_type',
    row: r as unknown as Row,
    message: `domain event ${r.domain_event_id} already has its event type, so ${r.id} cannot be a second: an event has one`,
  }));
}

/** A field's name as people read it: trimmed, and in any letter case. */
const spoken = (name: string) => name.trim().toLowerCase();

/**
 * Every field of the event that breaks LA-MOD-INV182 (a field is typed by exactly one of a basic type, a value object
 * or an aggregate) or LA-MOD-INV183 (no two fields of one event have the same name, trimmed and in any letter case).
 */
export function domainEventProblems(event: DomainEvent): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const named = new Map<string, EventFieldRow>();
  for (const field of event.fields) {
    const types = [field.type, field.type_value_object_id, field.type_aggregate_id].filter((t) => t !== undefined && t !== null);
    const row = field as unknown as Row;
    if (types.length !== 1) {
      problems.push({ rule: 'event-field-one-type', table: 'event_field', row, message: `field ${field.name} of domain event ${field.domain_event_id} is typed by ${types.length ? types.join(' and ') : 'nothing'}: a field has exactly one of a basic type, a value object or an aggregate` });
    }
    const earlier = named.get(spoken(field.name));
    if (earlier) {
      problems.push({ rule: 'event-field-name', table: 'event_field', row, message: `domain event ${field.domain_event_id} already has a field named ${earlier.name}, so its field ${field.position} cannot be named ${field.name}: a field's name is its own in its event, trimmed and in any letter case` });
    } else named.set(spoken(field.name), field);
  }
  return problems;
}

/** The rules over all data: every event, whole, and the "one event type" rule over every row. */
export const domainEventRules: AggregateRules = {
  aggregate: DOMAIN_EVENT_AGGREGATE,
  check: (view) => [
    ...domainEventsFrom((table) => view.rows(table)).flatMap((event) => domainEventProblems(event)),
    ...oneEventType(view.rows('event_type') as unknown as EventTypeRow[]),
  ],
};

/** Refuses the command, with every reason, when the event as it would be saved breaks one of its rules. */
export function holdToRules(_tx: Transaction, event: DomainEvent): void {
  refuseBroken(domainEventProblems(event));
}
