import type { SpecIndex, SpecLink, SpecRecord } from '../specs/data';
import { byIdOrder } from '../specs/data';

// Commands, domain events and policies as the Model view and the wiki read them: commands and events
// sit under their aggregate, a command `raises` events, a policy sits under the command it invokes
// and `hears` one event, of its own domain or another domain's published one. Pure lookups over the
// index, shared by the diagrams (erd.ts) and the aggregate's wiki page.

const childrenOfKind = (index: SpecIndex, id: string, kind: string) => (index.children.get(id) ?? []).filter((r) => r.kind === kind).sort(byIdOrder);

/** An aggregate's domain events, in ID order. */
export const eventsOf = (index: SpecIndex, aggregate: string): SpecRecord[] => childrenOfKind(index, aggregate, 'domain_event');

/** An aggregate's commands, in ID order. */
export const commandsOf = (index: SpecIndex, aggregate: string): SpecRecord[] => childrenOfKind(index, aggregate, 'command');

/** The policies invoking a command (sitting under it), in ID order. */
export const policiesOf = (index: SpecIndex, command: string): SpecRecord[] => childrenOfKind(index, command, 'policy');

/** The events a command raises, in ID order. */
export function raisedEvents(index: SpecIndex, command: string): SpecRecord[] {
  return (index.outgoing.get(command) ?? [])
    .filter((l) => l.relation === 'raises')
    .map((l) => index.byId.get(l.target))
    .filter((r): r is SpecRecord => r?.kind === 'domain_event')
    .sort(byIdOrder);
}

/** The event a policy hears, or null. */
export function heardEvent(index: SpecIndex, policy: string): SpecRecord | null {
  const link = (index.outgoing.get(policy) ?? []).find((l) => l.relation === 'hears');
  return (link && index.byId.get(link.target)) || null;
}

/** The `raises` links to an event, by command in ID order. */
export function raisingLinks(index: SpecIndex, event: string): SpecLink[] {
  return (index.incoming.get(event) ?? []).filter((l) => l.relation === 'raises').sort((a, b) => a.source.localeCompare(b.source, 'en', { numeric: true }));
}

/** The `hears` links to an event, by policy in ID order. */
export function hearingLinks(index: SpecIndex, event: string): SpecLink[] {
  return (index.incoming.get(event) ?? []).filter((l) => l.relation === 'hears').sort((a, b) => a.source.localeCompare(b.source, 'en', { numeric: true }));
}

/** The policies hearing an event, from any domain, in ID order. */
export const hearingPolicies = (index: SpecIndex, event: string): SpecRecord[] =>
  hearingLinks(index, event).map((l) => index.byId.get(l.source)).filter((r): r is SpecRecord => r?.kind === 'policy');
