// The Domain event aggregate's rules, written once: each command's handler runs them on the rows it would save, and
// every load and commit runs them over all data (domainEventRules, listed in AGGREGATE_RULES).
import { beyondFirst, type AggregateRules, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { EventTypeRow } from '../../platform/data/tables.ts';
import { DOMAIN_EVENT_AGGREGATE } from './model.ts';

/** Every row that breaks LA-AUT-INV108: a domain event has at most one event type. Each after the first is refused. */
export function oneEventType(eventTypes: readonly EventTypeRow[]): RuleProblem[] {
  return beyondFirst(eventTypes, (r) => r.domain_event_id).map((r) => ({
    rule: 'one-event-type',
    table: 'event_type',
    row: r as unknown as Row,
    message: `domain event ${r.domain_event_id} already has its event type, so ${r.id} cannot be a second: an event has one`,
  }));
}

/** The rules over all data. */
export const domainEventRules: AggregateRules = {
  aggregate: DOMAIN_EVENT_AGGREGATE,
  check: (view) => oneEventType(view.rows('event_type') as unknown as EventTypeRow[]),
};
