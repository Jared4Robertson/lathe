import type { TraceJourney } from '../../../../lathe/src/traceability/trace/read-model';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { RecordLink } from '../../specs/parts';
import { useJourneyProof } from './reads';

// A journey in a list (a product's Discovery, an outcome's Journeys): its link and how far it is proved, rolled up by
// the Trace read model (LA-TRC-RM13), in one line. The line is the journey page's too (proofLine).

/** A count with its noun. */
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The journey's proof in words: "3 steps · 2 proved · 1 carrying out nothing yet · journey test proved". */
export function proofLine(proof: TraceJourney): string {
  const { steps, stepsProved, unlinked } = proof.status;
  return [
    count(steps, 'step', 'steps'),
    `${stepsProved} proved`,
    ...(unlinked > 0 ? [`${unlinked} carrying out nothing yet`] : []),
    proof.test === null ? 'no journey test' : `journey test ${proof.testProved ? 'proved' : 'not proved'}`,
  ].join(' · ');
}

/** A journey's row: its link and, once read, its proof line. */
export function JourneyLine({ index, id, proof }: { index: RecordIndex; id: string; proof: TraceJourney | null }) {
  return (
    <div className="record-row journey-line" data-journey={id}>
      <RecordLink index={index} id={id} row />
      {proof && <small className={`meta journey-line-proof${proof.proved ? ' is-proved' : ''}`} data-meta="proof">{proof.proved ? '✓ ' : ''}{proofLine(proof)}</small>}
    </div>
  );
}

/** A journey's row that reads its own proof. */
export function JourneyLineRead({ index, id }: { index: RecordIndex; id: string }) {
  const read = useJourneyProof(id, index);
  return <JourneyLine index={index} id={id} proof={read.state === 'read' && read.answer.id === id ? read.answer : null} />;
}
