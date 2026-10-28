import type { SpecIndex, SpecLink, SpecRecord } from '../specs/data';
import { byIdOrder } from '../specs/data';

// Domain events as an aggregate's wiki page reads them (app/src/specs/DomainEvents.tsx): events sit
// under their aggregate, a command `raises` them and a policy `hears` one. Pure lookups over the index.

/** An aggregate's domain events, in ID order. */
export const eventsOf = (index: SpecIndex, aggregate: string): SpecRecord[] =>
  (index.children.get(aggregate) ?? []).filter((r) => r.kind === 'domain_event').sort(byIdOrder);

/** The `raises` links to an event, by command in ID order. */
export function raisingLinks(index: SpecIndex, event: string): SpecLink[] {
  return (index.incoming.get(event) ?? []).filter((l) => l.relation === 'raises').sort((a, b) => a.source.localeCompare(b.source, 'en', { numeric: true }));
}

/** The `hears` links to an event, by policy in ID order. */
export function hearingLinks(index: SpecIndex, event: string): SpecLink[] {
  return (index.incoming.get(event) ?? []).filter((l) => l.relation === 'hears').sort((a, b) => a.source.localeCompare(b.source, 'en', { numeric: true }));
}
