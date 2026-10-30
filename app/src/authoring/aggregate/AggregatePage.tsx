import type { AggregatePage as Aggregate, EventOnPage } from '../../../../lathe/src/authoring/aggregate/read-model';
import { LongList } from '../../components/LongList';
import { plural } from '../../plural';
import type { AggregatePageProps } from '../../record/pages';
import { RowsSection, Summary, TestScenario, Text, readState, type Fact } from '../../record/page-parts';
import { kindLabel, type Row, type SpecIndex } from '../../specs/data';
import { linkLabel } from '../../specs/labels';
import { ProblemBadge, RecordLink, Section } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { FieldsTable } from '../../specs/RecordText';
import { AggregateEditor } from './AggregateEditor';
import { useAggregate } from './reads';

// The Aggregate page (LA-AUT-A6's page, LA-V130): any record of an aggregate, at its address (/<id>), drawn from the
// aggregate read whole (GET /api/aggregate/get-aggregate) and changed only through its own commands (AggregateEditor).
// The aggregate itself shows its description, identity, entities, invariants and the domain events that happen to it,
// each event saying what raises it and how many policies hear it; an entity its description, fields, data model,
// commands and tables; an invariant its statement, rule and test; a data model and a rule their file and packages (their
// facts); an invariant test its scenario. What every record's page holds around that (traceability, problems, facts and links)
// is the Record page's (RecordFrame).

/** A list of one kind is titled by that kind's plural label (LA-V92-R09). */
const titleOf = (index: SpecIndex, kind: string) => plural(kindLabel(index, kind));

const entityOf = (page: Aggregate, id: string) => page.entities.find((e) => e.entity.id === id)!;
const invariantOf = (page: Aggregate, id: string) => page.invariants.find((i) => i.invariant.id === id)!;
const dataModelOf = (page: Aggregate, id: string) => page.entities.find((e) => e.dataModel?.dataModel.id === id)!;
const testOf = (page: Aggregate, id: string) => page.invariants.find((i) => i.test?.test.id === id)!;
const ruleOf = (page: Aggregate, id: string) => page.invariants.find((i) => i.rule?.rule.id === id)!;

/** One domain event of the aggregate: a whole-row link to it saying whether it is published, what raises it and how many policies hear it, in the relations' own words. */
function EventRow({ index, row }: { index: SpecIndex; row: EventOnPage }) {
  const { event, raisedBy, heardBy } = row;
  const raised = raisedBy.length > 0 ? `${linkLabel(index, { source: raisedBy[0], relation: 'raises', target: event.id }, 'target')} ${raisedBy.map((id) => index.byId.get(id)?.title ?? id).join(', ')}` : null;
  const heard = heardBy.length > 0 ? `${linkLabel(index, { source: heardBy[0], relation: 'hears', target: event.id }, 'target')} ${heardBy.length}` : null;
  return (
    <div className="record-row event-row">
      <RecordLink index={index} id={event.id} row />
      <span className="row-tags">
        {event.published && <small className="meta" data-meta="published">published</small>}
        {raised && <small className="meta" data-meta="raised-by">{raised}</small>}
        {heard && <small className="meta" data-meta="heard-by">{heard}</small>}
        <ProblemBadge problems={index.problemsFor.get(event.id) ?? []} />
      </span>
    </div>
  );
}

/** The aggregate's domain events, titled by their kind, or nothing when it has none. */
function DomainEvents({ index, page }: { index: SpecIndex; page: Aggregate }) {
  const events = page.domainEvents;
  if (events.length === 0) return null;
  return (
    <Section title={titleOf(index, 'domain_event')} count={events.length} className="domain-events">
      <LongList label={`${titleOf(index, 'domain_event')} of ${page.aggregate.id}`} className="record-list domain-event-list" items={events} itemKey={(e) => e.event.id}
        searchText={(e) => `${e.event.id} ${e.event.title}`} render={(e) => <EventRow index={index} row={e} />} />
    </Section>
  );
}

/** What one record of the aggregate shows on its page, by the kind it is in the aggregate. */
function Content({ index, page }: { index: SpecIndex; page: Aggregate }) {
  const { id, kind } = page.record;
  switch (kind) {
    case 'aggregate': {
      const { aggregate } = page;
      return (
        <>
          <Text index={index} id={id} source={aggregate.description} field="description" />
          <Text index={index} id={id} source={aggregate.identity} title="Identity" field="identity" />
          <RowsSection index={index} title={titleOf(index, 'entity')} ids={page.entities.map((e) => e.entity.id)} label={`${titleOf(index, 'entity')} of ${id}`} empty="No entity yet: add its root entity." className="aggregate-entities" />
          <RowsSection index={index} title={titleOf(index, 'invariant')} ids={page.invariants.map((i) => i.invariant.id)} label={`${titleOf(index, 'invariant')} of ${id}`} empty="No invariant yet." />
          <DomainEvents index={index} page={page} />
          <Text index={index} id={id} source={aggregate.notes} title="Notes" field="notes" />
        </>
      );
    }
    case 'entity': {
      const e = entityOf(page, id);
      return (
        <>
          <Text index={index} id={id} source={e.entity.description} field="description" />
          {e.fields.length > 0 && <FieldsTable index={index} rows={e.fields as unknown as Row[]} owner={id} />}
          <RowsSection index={index} title={titleOf(index, 'data_model')} ids={e.dataModel ? [e.dataModel.dataModel.id] : []} label={`${titleOf(index, 'data_model')} of ${id}`} empty="No data model yet." />
          <RowsSection index={index} title={titleOf(index, 'command')} ids={e.commands} label={`${titleOf(index, 'command')} of ${id}`} empty="No command changes it yet." className="entity-commands" />
          {e.tables.length > 0 && <RowsSection index={index} title={titleOf(index, 'table')} ids={e.tables} label={`${titleOf(index, 'table')} of ${id}`} empty="" />}
        </>
      );
    }
    case 'invariant': {
      const i = invariantOf(page, id);
      return (
        <>
          <Text index={index} id={id} source={i.invariant.statement} field="statement" />
          <RowsSection index={index} title={titleOf(index, 'rule')} ids={i.rule ? [i.rule.rule.id] : []} label={`${titleOf(index, 'rule')} of ${id}`} empty="No rule enforces it yet." />
          <RowsSection index={index} title={titleOf(index, 'invariant_test')} ids={i.test ? [i.test.test.id] : []} label={`${titleOf(index, 'invariant_test')} of ${id}`} empty="No test proves it yet." />
        </>
      );
    }
    case 'data_model':
    case 'rule':
      // A data model and a rule are their file and the standard rules and packages they meet and use: all in their facts and links.
      return null;
    case 'invariant_test': {
      const { test, startsFrom } = testOf(page, id).test!;
      return <TestScenario index={index} id={id} when={test.when} then={test.then} notes={test.notes} startsFrom={startsFrom} />;
    }
  }
}

/** The record's lead and key facts in the wiki card. */
function summaryOf(index: SpecIndex, page: Aggregate): { lead?: string; facts: Fact[] } {
  const { id, kind } = page.record;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const inAggregate: Fact = { label: 'Aggregate', value: <RecordLink index={index} id={page.aggregate.id} /> };
  switch (kind) {
    case 'aggregate':
      return {
        lead: page.aggregate.description,
        facts: [
          { label: 'Domain', value: <RecordLink index={index} id={page.aggregate.domain_id} /> },
          { label: 'Identity', value: page.aggregate.identity },
          { label: 'Holds', value: `${count(page.entities.length, 'entity', 'entities')}, ${count(page.invariants.length, 'invariant', 'invariants')}, ${count(page.domainEvents.length, 'domain event', 'domain events')}` },
        ],
      };
    case 'entity': {
      const e = entityOf(page, id);
      return { lead: e.entity.description, facts: [inAggregate, { label: 'Role', value: e.entity.role }, { label: 'Fields', value: e.fields.length }, { label: 'Commands', value: e.commands.length }] };
    }
    case 'invariant': {
      const i = invariantOf(page, id);
      return {
        lead: i.invariant.statement,
        facts: [
          inAggregate,
          { label: 'Rule', value: i.rule ? <RecordLink index={index} id={i.rule.rule.id} /> : 'none yet' },
          { label: 'Test', value: i.test ? <RecordLink index={index} id={i.test.test.id} /> : 'none yet' },
        ],
      };
    }
    case 'rule': {
      const i = ruleOf(page, id);
      const r = i.rule!;
      return {
        facts: [
          { label: 'Enforces', value: <RecordLink index={index} id={i.invariant.id} /> },
          ...(r.rule.file ? [{ label: 'File', value: <code>{r.rule.file}</code> }] : []),
          ...(r.packages.length ? [{ label: 'Packages', value: r.packages.join(', ') }] : []),
        ],
      };
    }
    case 'data_model': {
      const e = dataModelOf(page, id);
      const d = e.dataModel!;
      return {
        facts: [
          { label: 'Entity', value: <RecordLink index={index} id={e.entity.id} /> },
          ...(d.dataModel.file ? [{ label: 'File', value: <code>{d.dataModel.file}</code> }] : []),
          ...(d.packages.length ? [{ label: 'Packages', value: d.packages.join(', ') }] : []),
        ],
      };
    }
    case 'invariant_test': {
      const { test } = testOf(page, id).test!;
      return { lead: test.when, facts: [{ label: 'Proves', value: <RecordLink index={index} id={test.invariant_id} /> }, { label: 'Level', value: test.level }, { label: 'State', value: test.state }] };
    }
  }
}

/** A record of an aggregate: its page (or its summary in the wiki card), with its editor's actions. */
export function AggregatePage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useAggregate(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  return (
    <AggregateEditor index={index} page={page}>
      {summary ? (
        <div className="spec-body wiki-panel-summary"><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className="spec-body" data-aggregate="aggregate">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </AggregateEditor>
  );
}
