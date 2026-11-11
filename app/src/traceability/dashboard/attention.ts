import type { TraceJourney } from '../../../../lathe/src/traceability/trace/read-model';
import type { ListedProblem } from '../../../../lathe/src/checking/problems/read-model';
import type { QuestionEntry } from '../../../../lathe/src/product/product/read-model';
import type { GapFigure, ScopeCoverage } from '../../../../lathe/src/traceability/coverage/read-model';
import { compareIds, kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { addressOf } from '../../views/address';
import { panelHref } from '../../views/overlays';
import { lowerLabel } from '../../plural';
import { gapText } from '../../specs/parts';

// Needs attention (LA-V157): the top few of what a person can act on now, in fixed order, never scored. The kinds, in
// order: errors by check, open questions, journeys not proved (least proved first), and records with gaps (most first).
// The rows take the first of each kind in turn, so one long kind never crowds the others out; the rest is in Checks.

export interface AttentionRow {
  id: string;
  title: string;
  detail: string;
  to: string;
  /** Where the row leads, in a word. */
  lead: string;
}

/** How many rows Needs attention shows; Checks holds the rest. */
const ROWS = 3;

const roundRobin = <T,>(bands: readonly (readonly T[])[], count: number): T[] => {
  const out: T[] = [];
  for (let at = 0; out.length < count && bands.some((b) => at < b.length); at++) {
    for (const band of bands) {
      if (at < band.length && out.length < count) out.push(band[at]);
    }
  }
  return out;
};

/** A gap's cause in few words, its kind's name dropped: "reads nothing", "no reader". */
function gapWords(index: RecordIndex, gap: GapFigure): string {
  const text = gapText(gap.missing).replace(/\bwithout\b/, 'no');
  const kind = `${lowerLabel(kindLabel(index, gap.kind))} `;
  return text.startsWith(kind) ? text.slice(kind.length) : text;
}

function errorRows(problems: readonly ListedProblem[]): AttentionRow[] {
  const byCheck = new Map<string, ListedProblem[]>();
  for (const p of problems) if (p.severity === 'error') byCheck.set(p.check, [...(byCheck.get(p.check) ?? []), p]);
  return [...byCheck].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([check, group]) => ({
    id: check, title: group[0].message, detail: `${group.length} error${group.length === 1 ? '' : 's'} from this check`, to: panelHref('checks'), lead: 'Checks',
  }));
}

const questionRows = (questions: readonly QuestionEntry[]): AttentionRow[] =>
  questions.map((q) => ({ id: q.id, title: q.title, detail: `Open question, owned by the ${q.owner}`, to: addressOf(q.id), lead: 'Question' }));

/** The journey test's words: "journey test not automated yet", "no journey test", "journey test proved". */
export function testWords(journey: TraceJourney, state: string | null | undefined): string {
  if (journey.test === null) return 'no journey test';
  if (journey.testProved) return 'journey test proved';
  return state === 'not automated yet' ? 'journey test not automated yet' : 'journey test not proved';
}

function journeyRows(index: RecordIndex, journeys: readonly TraceJourney[]): AttentionRow[] {
  const share = (j: TraceJourney) => (j.status.steps ? j.status.stepsProved / j.status.steps : 0);
  return journeys.filter((j) => !j.proved).sort((a, b) => share(a) - share(b) || compareIds(a.id, b.id)).map((j) => ({
    id: j.id, title: index.byId.get(j.id)?.title ?? j.id,
    detail: `${j.status.stepsProved} of ${j.status.steps} steps proved; ${testWords(j, j.test ? index.byId.get(j.test)?.testState : null)}`,
    to: addressOf(j.id), lead: 'Journey',
  }));
}

function gapRows(index: RecordIndex, scopes: readonly ScopeCoverage[]): AttentionRow[] {
  const byRecord = new Map<string, GapFigure[]>();
  for (const g of scopes.flatMap((s) => s.gaps)) if (index.byId.has(g.id)) byRecord.set(g.id, [...(byRecord.get(g.id) ?? []), g]);
  return [...byRecord].sort((a, b) => b[1].length - a[1].length || compareIds(a[0], b[0])).map(([id, gaps]) => ({
    id, title: index.byId.get(id)!.title, detail: `${gaps.length} gap${gaps.length === 1 ? '' : 's'}: ${gaps.map((g) => gapWords(index, g)).join(', ')}`, to: addressOf(id), lead: index.byId.get(id)!.kind === 'journey' ? 'Journey' : 'Record',
  }));
}

/** The rows Needs attention shows, in order; the rest is in Checks. */
export function needsAttention(index: RecordIndex, problems: readonly ListedProblem[], questions: readonly QuestionEntry[], journeys: readonly TraceJourney[], scopes: readonly ScopeCoverage[]): AttentionRow[] {
  return roundRobin([errorRows(problems), questionRows(questions), journeyRows(index, journeys), gapRows(index, scopes)], ROWS);
}
