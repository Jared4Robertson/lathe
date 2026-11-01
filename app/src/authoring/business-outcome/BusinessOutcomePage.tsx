import type { ReactNode } from 'react';
import type { BusinessOutcomePage as Outcome } from '../../../../lathe/src/authoring/business-outcome/read-model';
import { Refusal, problemText } from '../../edit/fields';
import type { AggregatePageProps } from '../../record/pages';
import { Markdown } from '../../specs/Markdown';
import { Prose } from '../../specs/mentions';
import { RecordLink, Section, SpecLink } from '../../specs/parts';
import { checkPagePath } from '../../format/reference';
import { JourneyLineRead } from '../journey/JourneyLine';
import { RecordFrame } from '../../specs/RecordContent';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { BusinessOutcomeEditor } from './BusinessOutcomeEditor';
import { useBusinessOutcome } from './reads';

// The Business outcome page (LA-AUT-A16's page): an outcome at its address (/<id>), drawn from its page read through
// the aggregate's own query (GET /api/business-outcome/get-business-outcome) and changed only through its own commands
// (BusinessOutcomeEditor): its statement as the lead, then its measure, its target, how it is measured outside the code
// when it says so, and its notes. What every record's page holds around that (its Traceability with what measures it
// and what serves it, problems, facts and links) is the Record page's (RecordFrame).

/** A text of the outcome, read as Markdown with the IDs it names as links, under its heading or as the page's lead. */
function Text({ index, id, source, title, field }: { index: RecordIndex; id: string; source: string | undefined; title?: string; field: string }) {
  if (!source?.trim()) return null;
  const prose = <Prose index={index} source={source} self={id} />;
  return title ? <Section title={title} className={`record-${field}`}>{prose}</Section> : <div className="record-lead" data-field={field}>{prose}</div>;
}

/** The journeys that serve the outcome, each with how far it is proved; for a duration measure that no journey serves, the check that says so. */
function Journeys({ index, page }: { index: RecordIndex; page: Outcome }) {
  const { outcome, journeys } = page;
  const owed = (index.problemsFor.get(outcome.id) ?? []).some((p) => p.check === 'outcome-duration-without-journey');
  return (
    <Section title="Journeys" count={journeys.length} className="outcome-journeys">
      {journeys.length === 0 ? (
        <p className="hint">
          No journey serves it yet.
          {owed && <> Its measure reads as a duration, which a journey times: <SpecLink to={checkPagePath('outcome-duration-without-journey')} className="check-link" title="How the outcome-duration-without-journey check works"><code className="check-name">outcome-duration-without-journey</code></SpecLink></>}
        </p>
      ) : (
        <ul className="plain record-list" aria-label={`Journeys that serve ${outcome.id}`}>
          {journeys.map((j) => <li key={j.id}><JourneyLineRead index={index} id={j.id} /></li>)}
        </ul>
      )}
    </Section>
  );
}

/** The outcome's own texts, in their order. */
function Content({ index, page }: { index: RecordIndex; page: Outcome }) {
  const { outcome } = page;
  return (
    <>
      <Text index={index} id={outcome.id} source={outcome.statement} field="statement" />
      <Text index={index} id={outcome.id} source={outcome.measure} title="Measure" field="measure" />
      <Text index={index} id={outcome.id} source={outcome.target} title="Target" field="target" />
      <Journeys index={index} page={page} />
      <Text index={index} id={outcome.id} source={outcome.measured_outside} title="Measured outside the code" field="measured_outside" />
      <Text index={index} id={outcome.id} source={outcome.notes} title="Notes" field="notes" />
    </>
  );
}

/** The outcome's summary in the wiki card: its statement and a few key facts. */
function Summary({ index, page }: { index: RecordIndex; page: Outcome }) {
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const facts: { label: string; value: ReactNode }[] = [
    { label: 'Product', value: <RecordLink index={index} id={page.outcome.product_id} /> },
    { label: 'Target', value: page.outcome.target },
    { label: 'Holds', value: `${count(page.servedBy.length, 'capability serving it', 'capabilities serving it')}, ${count(page.journeys.length, 'journey', 'journeys')}, ${count(page.measuredBy.length, 'measure', 'measures')}` },
  ];
  return (
    <>
      <div className="wiki-panel-lead"><Markdown source={page.outcome.statement} /></div>
      <dl className="fields">{facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
    </>
  );
}

/** A business outcome: its page (or its summary in the wiki card), with its editor's actions. */
export function BusinessOutcomePage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useBusinessOutcome(id, index);
  const record = index.byId.get(id);
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  if (!record) return <div className={body}><p>There's no record with the ID <code>{id}</code>.</p></div>;
  if (read.state === 'refused') {
    return <div className={body}><Refusal title={`${id} could not be read.`} reasons={read.problems.length ? read.problems.map(problemText) : [read.error]} focusKey={0} /></div>;
  }
  // Until the outcome is read (or while the read is of data before it was added), the page says so.
  const page = read.state === 'read' && read.answer.outcome.id === id ? read.answer : null;
  if (!page) return <div className={body}><p className="hint" role="status">Reading {id}…</p></div>;
  return (
    <BusinessOutcomeEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary index={index} page={page} />{after}</div>
      ) : (
        <div className={body} data-aggregate="business-outcome">
          <RecordFrame index={index} record={record}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </BusinessOutcomeEditor>
  );
}
