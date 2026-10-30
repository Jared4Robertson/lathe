import type { DomainEventPage as DomainEvent } from '../../../../lathe/src/authoring/domain-event/read-model';
import { plural } from '../../plural';
import type { AggregatePageProps } from '../../record/pages';
import { RowsSection, Summary, Text, readState, type Fact } from '../../record/page-parts';
import { kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { RecordLink } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { FieldsTable } from '../../specs/FieldsTable';
import { DomainEventEditor } from './DomainEventEditor';
import { useDomainEvent } from './reads';

// The Domain event page (LA-AUT-A7's page, LA-V131): a domain event or its event type, at its address (/<id>), drawn
// from the event read whole (GET /api/domain-event/get-domain-event) and changed only through its own commands
// (DomainEventEditor). The event shows its description, the fields it carries and its event type; what raises it and
// what hears it are in its Traceability, in the relations' own words. An event type is its delivery, file and
// packages: all in its facts. What every record's page holds around that (traceability, problems, facts and links) is
// the Record page's (RecordFrame).

/** A list of one kind is titled by that kind's plural label (LA-V92-R09). */
const titleOf = (index: RecordIndex, kind: string) => plural(kindLabel(index, kind));

/** What one record of the event shows on its page, by the kind it is in the event. */
function Content({ index, page }: { index: RecordIndex; page: DomainEvent }) {
  const { id, kind } = page.record;
  if (kind === 'event_type') return null;
  return (
    <>
      <Text index={index} id={id} source={page.event.description} field="description" />
      {page.fields.length > 0 && <FieldsTable index={index} rows={page.fields} owner={id} />}
      <RowsSection index={index} title={titleOf(index, 'event_type')} ids={page.eventType ? [page.eventType.eventType.id] : []} label={`${titleOf(index, 'event_type')} of ${id}`} empty="No event type yet: add one when a policy or a projection hears it in code." />
    </>
  );
}

/** The record's lead and key facts in the wiki card. */
function summaryOf(index: RecordIndex, page: DomainEvent): { lead?: string; facts: Fact[] } {
  if (page.record.kind === 'event_type') {
    const type = page.eventType!;
    return {
      facts: [
        { label: 'Domain event', value: <RecordLink index={index} id={page.event.id} /> },
        ...(type.eventType.delivery ? [{ label: 'Delivery', value: type.eventType.delivery }] : []),
        ...(type.eventType.file ? [{ label: 'File', value: <code>{type.eventType.file}</code> }] : []),
      ],
    };
  }
  return {
    lead: page.event.description,
    facts: [
      { label: 'Aggregate', value: <RecordLink index={index} id={page.event.aggregate_id} /> },
      { label: 'Published', value: page.event.published ? 'yes' : 'no' },
      { label: 'Fields', value: page.fields.length },
      { label: 'Raised by', value: page.raisedBy.length },
      { label: 'Heard by', value: page.heardBy.length },
    ],
  };
}

/** A record of a domain event: its page (or its summary in the wiki card), with its editor's actions. */
export function DomainEventPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useDomainEvent(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  return (
    <DomainEventEditor index={index} page={page}>
      {summary ? (
        <div className="spec-body wiki-panel-summary"><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className="spec-body" data-aggregate="domain-event">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </DomainEventEditor>
  );
}
