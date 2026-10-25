import type { SpecIndex, SpecLink, SpecRecord } from '../specs/data';
import { byIdOrder } from '../specs/data';

// Domain events as the Model view and the wiki read them (FORMAT.md: `domain_event`): each sits
// under the aggregate that raises it, `raised_by` may name the entity of that aggregate whose change
// raises it, and the records that react link to it with `reacts_to`, from any aggregate or domain.
// Pure lookups over the index, shared by the ERD (erd.ts) and the aggregate's wiki page.

export const EVENT_KIND = 'domain_event';

/** An aggregate's domain events, in ID order. */
export function eventsOf(index: SpecIndex, aggregate: string): SpecRecord[] {
  return (index.children.get(aggregate) ?? []).filter((r) => r.kind === EVENT_KIND).sort(byIdOrder);
}

/** The aggregate an event sits under, or null. */
export function eventAggregate(index: SpecIndex, event: SpecRecord): SpecRecord | null {
  const parent = event.parent ? index.byId.get(event.parent) : undefined;
  return parent?.kind === 'aggregate' ? parent : null;
}

/** The event's `raised_by` links to entities, in ID order of the entity. */
export function raisedByLinks(index: SpecIndex, event: string): SpecLink[] {
  return (index.outgoing.get(event) ?? [])
    .filter((l) => l.relation === 'raised_by' && index.byId.get(l.target)?.kind === 'entity')
    .sort((a, b) => a.target.localeCompare(b.target, 'en', { numeric: true }));
}

/** Every `reacts_to` link to an event (from aggregates, use cases and components), by source in ID order. */
export function reactionLinks(index: SpecIndex, event: string): SpecLink[] {
  return (index.incoming.get(event) ?? [])
    .filter((l) => l.relation === 'reacts_to')
    .sort((a, b) => a.source.localeCompare(b.source, 'en', { numeric: true }));
}

/** The aggregates that react to an event, each with its link, in ID order. */
export function reactingAggregates(index: SpecIndex, event: string): { aggregate: SpecRecord; link: SpecLink }[] {
  return reactionLinks(index, event).flatMap((link) => {
    const aggregate = index.byId.get(link.source);
    return aggregate?.kind === 'aggregate' ? [{ aggregate, link }] : [];
  });
}

/** The events an aggregate reacts to, each with its link, in ID order of the event. */
export function reactionsOf(index: SpecIndex, aggregate: string): { event: SpecRecord; link: SpecLink }[] {
  return (index.outgoing.get(aggregate) ?? [])
    .filter((l) => l.relation === 'reacts_to')
    .flatMap((link) => {
      const event = index.byId.get(link.target);
      return event?.kind === EVENT_KIND ? [{ event, link }] : [];
    })
    .sort((a, b) => byIdOrder(a.event, b.event));
}
