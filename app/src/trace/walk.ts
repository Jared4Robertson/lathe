import { stepName } from '../graph/steps';
import type { RecordIndex } from '../exploring/record-summaries/record-index';
import type { Move } from '../views/levels';
import type { WalkBar } from '../views/StageChrome';
import { journeyBox, JOURNEY_COLUMN, OUTCOME_COLUMN, STAGE_COLUMN, TRACE_COLUMN_LABELS, TRACE_COLUMNS, isOpen, shownChildren, wordsName, type TraceGraph, type Openness } from './trace';
import type { TraceLaid } from './layout';

// The Trace stage's walk (LA-V61-R49, LA-V98), pure and tested directly: Up and Down within a column, top to bottom as
// shown (through a box's children and on to the next row); Left and Right along the links to the nearest box linked to it
// in the next column that way (an outcome and the journeys serving it, else the use cases it serves; a journey and the
// rows it carries out; a requirement and the steps fulfilling it; a step and its chain), else to the row's own box in
// that column; In opens a box and steps to its first child; Out steps to its parent, and on a cell's own box closes it.
// Along a journey (LA-V98-R25): Right from a journey goes to the row of its first step carrying out a use case, from one
// of its steps to that step's row; from there Down and Up go to the next and previous step's row in the journey's order,
// main path first, and Left back to the step. From no box (the product, or a record the view does not draw) any move goes
// to the first row's use case. TraceView.tsx moves the focus or the ring, and keeps the journey the walk is along.

/**
 * On a phone, the walk's bar (LA-V93-R76): Previous and Next along the row, Left and Right, through its stages from its
 * outcomes to its acceptance tests; Up and Down, which step to the box above or below in a column (the next row's), stay in More.
 */
export const TRACE_WALK_BAR: WalkBar = { previous: 'left', next: 'right', more: ['up', 'down'] };

/** What each step button does, for its name and tooltip. */
export const TRACE_WALK_LABELS: Record<Move, string> = {
  left: 'Step along the row to the nearest linked box on the left',
  right: 'Step along the row to the nearest linked box on the right',
  up: 'Step to the box above in its column',
  down: 'Step to the box below in its column',
  out: 'Out to the box this one is in, or close it',
  in: 'In to the first child, opening the box',
};

/** The journey a walk is along, and the step whose row it stands on. */
export interface Along { journey: string; step: string }

/** Where a move goes: the box, the key to open or close on the way (In and Out), and the journey it is then along. */
export interface WalkTo { to: string; toggle?: string; along?: Along }

const USE_CASE_COLUMN = STAGE_COLUMN['use-case'];

/** Where a move goes from a box (null for none), along a journey or not, or null. */
export function traceTarget(graph: TraceGraph, laid: TraceLaid, o: Openness, at: string | null, move: Move, along: Along | null = null): WalkTo | null {
  const item = at && laid.places.has(at) ? graph.items.get(at) : undefined;
  if (!item || !at) {
    const first = laid.columns[USE_CASE_COLUMN][0] ?? laid.columns[OUTCOME_COLUMN][0];
    return first ? { to: first } : null;
  }
  const shownBox = (id: string) => graph.boxesOf.get(id)?.find((k) => laid.places.has(k));
  // Along a journey, on the use case of its step's row: Down and Up to the next and previous step's row, Left back to the step.
  const steps = along ? graph.carries.filter((c) => c.journey === along.journey && laid.places.has(`${c.useCase}|use-case`)) : [];
  const here = along ? steps.findIndex((c) => c.step === along.step) : -1;
  if (along && here >= 0 && at === `${steps[here].useCase}|use-case`) {
    if (move === 'left') return { to: shownBox(along.step) ?? journeyBox(along.journey) };
    if (move === 'down' || move === 'up') {
      const next = steps[here + (move === 'down' ? 1 : -1)];
      if (next) return { to: `${next.useCase}|use-case`, along: { journey: along.journey, step: next.step } };
    }
  }
  // Right from a journey, to its first step's row; from one of its steps, to that step's row.
  if (move === 'right' && item.column === JOURNEY_COLUMN && item.id) {
    const j = graph.journeyOf.get(item.id);
    const first = j && graph.carries.find((c) => c.journey === j.id && (item.id === j.id || c.step === item.id) && laid.places.has(`${c.useCase}|use-case`));
    if (first) return { to: `${first.useCase}|use-case`, along: { journey: first.journey, step: first.step } };
  }
  if (move === 'up' || move === 'down') {
    const column = laid.columns[item.column];
    const to = column[column.indexOf(at) + (move === 'down' ? 1 : -1)];
    return to ? { to } : null;
  }
  if (move === 'in') {
    if (!item.opens) return null;
    if (isOpen(item, o)) { const first = shownChildren(graph, item, o)[0] ?? graph.items.get(at)!.children[0]; return first ? { to: first } : null; }
    const opened = { ...o, open: new Set([...o.open, item.opens]) };
    const first = shownChildren(graph, item, opened)[0];
    return { to: first ?? at, toggle: item.opens };
  }
  if (move === 'out') {
    if (item.parent) return { to: item.parent };
    return isOpen(item, o) ? { to: at, toggle: item.opens } : null;
  }
  const step = move === 'right' ? 1 : -1;
  const next = item.column + step;
  if (next < 0 || next >= TRACE_COLUMNS.length) return null;
  const y = laid.places.get(at)!.y;
  const nearest = (keys: readonly string[]) => keys.filter((k) => laid.places.has(k)).sort((a, b) => Math.abs(laid.places.get(a)!.y - y) - Math.abs(laid.places.get(b)!.y - y))[0];
  // From an outcome: the journeys serving it, else the use cases it serves.
  if (item.column === OUTCOME_COLUMN) {
    const to = nearest(graph.journeyServes.filter(([oc]) => `outcome/${oc}` === at).map(([, j]) => journeyBox(j))) ?? nearest(graph.serves.filter(([oc]) => `outcome/${oc}` === at).map(([, u]) => `${u}|use-case`));
    return to ? { to } : null;
  }
  // From a journey or one of its boxes, Left: the outcomes it serves.
  if (item.column === JOURNEY_COLUMN) {
    const j = item.id ? graph.journeyOf.get(item.id) : undefined;
    const to = step < 0 && j ? nearest(j.outcomes.map((oc) => `outcome/${oc}`)) : undefined;
    return to ? { to } : null;
  }
  const row = item.row ? graph.rowOf.get(item.row) : undefined;
  if (!row) return null;
  // Left from a row's use case column: the journeys carrying it out (a step's box while it shows), else the outcomes it serves.
  if (next === JOURNEY_COLUMN) {
    const carried = graph.carries.filter((c) => c.useCase === row.useCase).map((c) => shownBox(c.step) ?? journeyBox(c.journey));
    const to = nearest(carried) ?? nearest(row.data.outcomes.map((oc) => `outcome/${oc}`));
    return to ? { to } : null;
  }
  // Along the row's links from this box's record, to the boxes in the next column that show them.
  const id = item.id ?? at;
  const ends = row.links.filter((l) => (step > 0 ? l.from === id : l.to === id)).map((l) => (step > 0 ? l.to : l.from));
  const candidates = [...laid.places.keys()].filter((k) => { const c = graph.items.get(k)!; return c.row === row.useCase && c.column === next && (ends.includes(k) || (c.id !== null && ends.includes(c.id))); });
  const to = nearest(candidates) ?? row.cells[next];
  return to && laid.places.has(to) ? { to } : null;
}

/** What the walk says on a box: a record as the graph names it, another box by its words and column. */
export function traceWords(index: RecordIndex, graph: TraceGraph, key: string): string {
  const item = graph.items.get(key);
  if (!item) return key;
  if (item.role === 'record' && item.id) return stepName(index, item.id);
  return `${(item.words && wordsName(item.words)) || key}, ${TRACE_COLUMN_LABELS[TRACE_COLUMNS[item.column]]}`;
}
