import { LongList } from '../components/LongList';
import { eventsOf, hearingLinks, raisingLinks } from '../model/events';
import type { SpecIndex, SpecRecord } from './data';
import { linkLabel } from './labels';
import { ProblemBadge, RecordLink, Section, listTitle, recordText } from './parts';

// An aggregate's domain events on its wiki page (LA-TRC-UC14-R06): one list titled by its kind,
// "Domain events" (LA-EXP-DR36), each row a whole-row link to the event (LA-PAT-APP-UX-R05) that
// says which commands raise it and how many policies hear it, in the relations' own words from the
// schema (LA-EXP-V03-R07), and whether it is published. The event's page shows its Fields table in
// its body, and its Traceability says "Raised by" and "Heard by".

function EventRow({ index, event }: { index: SpecIndex; event: SpecRecord }) {
  const raised = raisingLinks(index, event.id);
  const heard = hearingLinks(index, event.id);
  const raisedWords = raised.length > 0 ? `${linkLabel(index, raised[0], 'target')} ${raised.map((l) => index.byId.get(l.source)?.title ?? l.source).join(', ')}` : null;
  const heardWords = heard.length > 0 ? `${linkLabel(index, heard[0], 'target')} ${heard.length}` : null;
  return (
    <div className="record-row event-row">
      <RecordLink index={index} id={event.id} row />
      <span className="row-tags">
        {event.row.published === true && <small className="meta" data-meta="published">published</small>}
        {raisedWords && <small className="meta" data-meta="raised-by">{raisedWords}</small>}
        {heardWords && <small className="meta" data-meta="heard-by">{heardWords}</small>}
        <ProblemBadge problems={index.problemsFor.get(event.id) ?? []} />
      </span>
    </div>
  );
}

/** The "Domain events" section of an aggregate's page, or nothing when it has none. */
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
