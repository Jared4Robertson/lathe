import type { ReactNode } from 'react';
import type { JourneyKind } from '../../../../lathe/src/product/journey/model';
import type { JourneyPage as JourneyRead, PathOnPage, StepOnPage } from '../../../../lathe/src/product/journey/read-model';
import type { TraceJourney, TraceJourneyStep } from '../../../../lathe/src/traceability/trace/read-model';
import { Button } from '../../components/Button';
import { StepMoves } from '../../edit/StepMoves';
import type { AggregatePageProps } from '../../record/pages';
import { Facts, RowsSection, Summary, Text, readState, type Fact } from '../../record/page-parts';
import { kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { Prose } from '../../specs/mentions';
import { ProblemBadge, RecordLink, Section } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { pathLabel } from '../../use-cases/use-case/FlowSteps';
import { JourneyEditor, useWriteUseCase } from './JourneyEditor';
import { proofLine } from './JourneyLine';
import { useJourney, useJourneyProof } from './reads';
import './journey.css';

// The Journey page (LA-PRD-A25's page): any record of a journey, at its address (/<id>), drawn from the journey read
// whole (GET /api/journey/get-journey) and changed only through its own commands (JourneyEditor). A journey shows what
// it runs from and to, the outcomes it serves, how far it is proved (the Trace read model's, GET
// /api/trace/get-journey-proof), its steps path by path in order, each with what it carries out, who acts and its
// proof, and its journey test; a step its place and what it carries out; the test its steps and expected result.
// Above the steps, on a wide screen, a strip of lanes (one per actor, and one for the product's handoffs) places each
// step in its lane left to right, so a handoff reads as a change of lane; it is decoration, and the ordered list under
// it is the page's order, the only one a phone shows. What every record's page holds around that (traceability,
// problems, facts and links) is the Record page's (RecordFrame).

const PRODUCT_LANE = 'The product';
/** A trigger or result as a clause of "From … to …": its closing full stop dropped, so the sentence reads on. */
const clause = (text: string): string => text.trim().replace(/\.$/, '');
const UNWRITTEN_LANE = 'Not written yet';

/** How far one step's use case or policy is proved, in words. */
function stepProof(step: TraceJourneyStep): string {
  if (step.proved) return 'Proved';
  if (step.built) return 'Built, not proved';
  if (step.designed) return 'Designed, not built';
  return 'Not designed';
}

/** The lane a step sits in: its main actor, the product for a handoff, or the lane of steps still to write. */
const laneOf = (step: StepOnPage): string => (step.carriesOut === null ? UNWRITTEN_LANE : step.carriesOut.kind === 'policy' ? PRODUCT_LANE : step.carriesOut.actors[0] ?? 'No actor named');

/** Who acts in a step: the use case's actors, or the product for a handoff. */
const actorsOf = (step: StepOnPage): string[] => (step.carriesOut === null ? [] : step.carriesOut.kind === 'policy' ? [PRODUCT_LANE] : step.carriesOut.actors);

/** One path as lanes: a row per actor in the order each first acts, a column per step, each step a numbered mark in its lane. Decoration only. */
function Lanes({ path }: { path: PathOnPage }) {
  const lanes = [...new Set(path.steps.map(laneOf))];
  if (lanes.length < 2) return null;
  return (
    <div className="journey-lanes" aria-hidden="true" style={{ gridTemplateColumns: `max-content repeat(${path.steps.length}, minmax(1.75rem, 1fr))` }}>
      {lanes.map((lane) => (
        <div key={lane} className="journey-lane">
          <span className="journey-lane-name">{lane}</span>
          {path.steps.map((s) => (
            <span key={s.step.id} className="journey-lane-cell">{laneOf(s) === lane && <span className={`journey-mark${s.carriesOut?.kind === 'policy' ? ' is-handoff' : ''}`}>{s.step.position}</span>}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** What a step carries out: the use case or handoff it links, with its place, or that no use case is written yet. */
function CarriesOut({ index, step }: { index: RecordIndex; step: StepOnPage }) {
  const writeUseCase = useWriteUseCase();
  const out = step.carriesOut;
  if (out === null) {
    return (
      <span className="journey-unlinked">
        <span className="hint">No use case yet</span>
        {writeUseCase && <Button onClick={() => writeUseCase(step.step.id, step.step.title)} aria-label={`Add a use case for ${step.step.id}`}>Add use case</Button>}
      </span>
    );
  }
  return (
    <>
      <span className="journey-carries">
        <small className="meta" data-meta="carries-out-kind">{out.kind === 'policy' ? 'Handoff' : kindLabel(index, out.kind)}</small>
        <RecordLink index={index} id={out.id} />
      </span>
      <small className="meta journey-place" data-meta="place">
        {out.kind === 'use_case'
          ? <>{out.capability.title} · {out.domain.title}</>
          : <>{out.hears ? <>hears <RecordLink index={index} id={out.hears.id} showTitle={false} /></> : 'hears nothing yet'} → sends <RecordLink index={index} id={out.sends.id} showTitle={false} /> · {out.domain.title}</>}
      </small>
    </>
  );
}

/** One path's steps as an ordered list: number, step, what it carries out, who acts and how far it is proved. */
function PathSteps({ index, path, proof }: { index: RecordIndex; path: PathOnPage; proof: TraceJourney | null }) {
  const ofStep = (id: string) => proof?.steps.find((s) => s.id === id);
  return (
    <>
      <Lanes path={path} />
      <ol className="journey-steps" aria-label={`Steps of the ${path.name} path`}>
        {path.steps.map((s, at) => {
          const { id } = s.step;
          const actors = actorsOf(s);
          const traced = ofStep(id);
          return (
            <li key={id} className="journey-step" data-step={id}>
              <span className="step-order">{s.step.position}</span>
              <div className="journey-step-body">
                <p className="journey-step-title"><RecordLink index={index} id={id} showTitle={false} /> {s.step.title} <ProblemBadge problems={index.problemsFor.get(id) ?? []} /></p>
                <div className="journey-step-what"><CarriesOut index={index} step={s} /></div>
                {actors.length > 0 && <small className="meta" data-meta="actors">{actors.join(', ')}</small>}
              </div>
              <div className="journey-step-side">
                {traced && s.carriesOut !== null && <span className={`journey-proof${traced.proved ? ' is-proved' : ''}`} data-proof={traced.proved ? 'proved' : 'not-proved'}>{traced.proved ? '✓ ' : ''}{stepProof(traced)}</span>}
                <StepMoves route="/api/journey/move-journey-step" id={id} up={path.steps[at - 1]?.step.position ?? null} down={path.steps[at + 1]?.step.position ?? null} />
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** The journey's steps, one list per path (the main path first), and the lanes above each. */
function Steps({ index, journey, proof }: { index: RecordIndex; journey: JourneyRead; proof: TraceJourney | null }) {
  const total = journey.paths.reduce((n, p) => n + p.steps.length, 0);
  return (
    <Section title="Steps" count={total} className="journey-steps-section">
      {total === 0 && <p className="hint">No steps yet.</p>}
      {journey.paths.length === 1
        ? <PathSteps index={index} path={journey.paths[0]} proof={proof} />
        : journey.paths.map((path) => (
          <section key={path.name} className="flow-path" aria-label={pathLabel(path.name)}>
            <h3>{pathLabel(path.name)}<span className="section-count">{path.steps.length}</span></h3>
            <PathSteps index={index} path={path} proof={proof} />
          </section>
        ))}
    </Section>
  );
}

/** The journey's header: from its trigger to its result, the outcomes it serves and how far it is proved. */
function Header({ index, journey, proof }: { index: RecordIndex; journey: JourneyRead; proof: TraceJourney | null }) {
  const { id, trigger, result } = journey.journey;
  return (
    <>
      <div className="journey-route record-lead" data-field="route">
        <span className="journey-route-word">From</span> <Prose index={index} source={clause(trigger)} self={id} /> <span className="journey-route-word">to</span> <Prose index={index} source={result} self={id} />
      </div>
      <div className="journey-serves" data-fact="serves">
        <span className="journey-serves-label">Serves</span>
        {journey.serves.length === 0
          ? <span className="hint">No outcome yet.</span>
          : <ul className="plain serves-list" aria-label={`Outcomes ${id} serves`}>{journey.serves.map((o) => <li key={o}><RecordLink index={index} id={o} /></li>)}</ul>}
      </div>
      {proof && <p className={`journey-proof-line${proof.proved ? ' is-proved' : ''}`} data-proof={proof.proved ? 'proved' : 'not-proved'}>{proof.proved ? '✓ Proved: ' : 'Not proved yet: '}{proofLine(proof)}</p>}
    </>
  );
}

/** What one record of the journey shows on its page, by the kind it is in the journey. */
function Content({ index, journey, proof, id, kind }: { index: RecordIndex; journey: JourneyRead; proof: TraceJourney | null; id: string; kind: JourneyKind }) {
  switch (kind) {
    case 'journey':
      return (
        <>
          <Header index={index} journey={journey} proof={proof} />
          <Text index={index} id={id} source={journey.journey.notes} title="Notes" field="notes" />
          <Steps index={index} journey={journey} proof={proof} />
          <RowsSection index={index} title="Journey test" ids={journey.test ? [journey.test.test.id] : []} label={`Journey test of ${id}`} empty="No journey test yet." />
        </>
      );
    case 'journey_step': {
      const { step, path } = stepOf(journey, id);
      const out = step.carriesOut;
      return (
        <>
          <Facts facts={[
            { label: 'Journey', value: <RecordLink index={index} id={step.step.journey_id} /> },
            { label: 'Path', value: path.name },
            { label: 'Position', value: step.step.position },
            { label: 'Carries out', value: out ? <RecordLink index={index} id={out.id} /> : <span className="hint">Nothing yet: a use case still to write</span> },
            ...(actorsOf(step).length ? [{ label: actorsOf(step).length === 1 ? 'Actor' : 'Actors', value: actorsOf(step).join(', ') }] : []),
          ]} />
        </>
      );
    }
    case 'journey_test': {
      const { test: row, startsFrom } = journey.test!;
      return (
        <>
          {(row.steps ?? []).length > 0 && (
            <Section title="Steps" count={row.steps.length}>
              <ol className="test-steps">{row.steps.map((s, i) => <li key={i}><Prose index={index} source={s} self={id} /></li>)}</ol>
            </Section>
          )}
          <Text index={index} id={id} source={row.expected_result} title="Expected result" field="expected_result" />
          <Text index={index} id={id} source={row.notes} title="Notes" field="notes" />
          {startsFrom.length > 0 && <RowsSection index={index} title="Starts from" ids={startsFrom} label={`Test data sets ${id} starts from`} empty="" />}
        </>
      );
    }
  }
}

/** A step with the path it is on. */
function stepOf(journey: JourneyRead, id: string): { step: StepOnPage; path: PathOnPage } {
  for (const path of journey.paths) {
    const step = path.steps.find((s) => s.step.id === id);
    if (step) return { step, path };
  }
  throw new Error(`${id} is no step of ${journey.journey.id}`);
}

/** The main path as a numbered one-liner, for the wiki card. */
const mainPathLine = (journey: JourneyRead): string => (journey.paths.find((p) => p.name === 'main')?.steps ?? []).map((s) => `${s.step.position}. ${s.step.title}`).join(' · ');

/** The record's lead and key facts in the wiki card. */
function summaryOf(index: RecordIndex, journey: JourneyRead, id: string, kind: JourneyKind): { lead?: string; facts: Fact[] } {
  const ofJourney: Fact = { label: 'Journey', value: <RecordLink index={index} id={journey.journey.id} /> };
  switch (kind) {
    case 'journey': {
      const main = mainPathLine(journey);
      return {
        lead: `From ${clause(journey.journey.trigger)} to ${journey.journey.result}`,
        facts: [
          { label: 'Serves', value: journey.serves.length ? <ul className="plain">{journey.serves.map((o) => <li key={o}><RecordLink index={index} id={o} /></li>)}</ul> : 'no outcome yet' },
          ...(main ? [{ label: 'Main path', value: main }] : []),
        ],
      };
    }
    case 'journey_step': {
      const { step, path } = stepOf(journey, id);
      return { facts: [ofJourney, { label: 'Path', value: `${path.name}, step ${step.step.position}` }, ...(step.carriesOut ? [{ label: 'Carries out', value: <RecordLink index={index} id={step.carriesOut.id} /> }] : [])] };
    }
    case 'journey_test': {
      const { test } = journey.test!;
      return { lead: test.expected_result, facts: [{ label: 'Proves', value: <RecordLink index={index} id={test.journey_id} /> }, { label: 'Level', value: test.level }, { label: 'State', value: test.state }] };
    }
  }
}

/** A record of a journey: its page (or its summary in the wiki card), with its editor's actions. */
export function JourneyPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useJourney(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  const root = 'answer' in state ? state.answer.journey.id : null;
  const proof = useJourneyProof(root, index);
  if ('shown' in state) return state.shown;
  const journey = state.answer;
  const kind = journey.record.kind;
  const traced = proof.state === 'read' && proof.answer.id === root ? proof.answer : null;
  const body: ReactNode = summary
    ? <div className="spec-body wiki-panel-summary"><Summary {...summaryOf(index, journey, id, kind)} />{after}</div>
    : (
      <div className="spec-body" data-aggregate="journey">
        <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} journey={journey} proof={traced} id={id} kind={kind} /></RecordFrame>
        {after}
      </div>
    );
  return <JourneyEditor index={index} page={journey}>{body}</JourneyEditor>;
}
