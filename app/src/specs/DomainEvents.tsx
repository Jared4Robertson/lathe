import { LongList } from '../components/LongList';
import { eventsOf, raisedByLinks, reactionLinks } from '../model/events';
import type { SpecIndex, SpecRecord } from './data';
import { linkLabel } from './labels';
import { ProblemBadge, RecordLink, Section, listTitle, recordText } from './parts';

// An aggregate's domain events on its wiki page (LA-BRW-UC118-R06): one list titled by its kind,
// "Domain events" (LA-BRW-DR160), each row a whole-row link to the event (LA-PAT-APP-UX-R05) that
// says which entity raises it and how many records react to it, in the relations' own words from
// the meta-model (LA-BRW-DR243). The event's page shows its Fields table in its body, as an
// entity's does, and its Traceability says "Raised by" and "Reacted to by".

function EventRow({ index, event }: { index: SpecIndex; event: SpecRecord }) {
  const raised = raisedByLinks(index, event.id);
  const reactions = reactionLinks(index, event.id);
  const raisedWords = raised.length > 0 ? `${linkLabel(index, raised[0], 'source')} ${raised.map((l) => index.byId.get(l.target)?.title ?? l.target).join(', ')}` : null;
  const reactedWords = reactions.length > 0 ? `${linkLabel(index, reactions[0], 'target')} ${reactions.length}` : null;
  return (
    <div className="record-row event-row">
      <RecordLink index={index} id={event.id} row />
      <span className="row-tags">
        {raisedWords && <small className="meta" data-meta="raised-by">{raisedWords}</small>}
        {reactedWords && <small className="meta" data-meta="reacted-to-by">{reactedWords}</small>}
        <ProblemBadge problems={index.problemsFor.get(event.id) ?? []} />
      </span>
    </div>
  );
}

/** The "Domain events" section of an aggregate's page, or nothing when it raises none. */
export function DomainEvents({ index, aggregate }: { index: SpecIndex; aggregate: SpecRecord }) {
  const events = eventsOf(index, aggregate.id);
  if (events.length === 0) return null;
  const title = listTitle(index, events, 'Domain events');
  return (
    <Section title={title} count={events.length} className="domain-events">
      <LongList
        label={`${title} of ${aggregate.id}`}
        className="record-list domain-event-list"
        items={events}
        itemKey={(r) => r.id}
        searchText={recordText}
        render={(r) => <EventRow index={index} event={r} />}
      />
    </Section>
  );
}
