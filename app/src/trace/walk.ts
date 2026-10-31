import { stepName } from '../graph/steps';
import type { RecordIndex } from '../exploring/record-summaries/record-index';
import type { Move } from '../views/levels';
import { TRACE_COLUMN_LABELS, TRACE_COLUMNS, isOpen, shownChildren, type TraceGraph, type Openness } from './trace';
import type { TraceLaid } from './layout';

// The Trace stage's walk (LA-V61-R49, LA-V98), pure and tested directly: Up and Down within a column, top to bottom as
// shown (through a box's children and on to the next row); Left and Right along the row's links to the nearest box
// linked to it in the next column that way (an outcome and the use cases it serves; a requirement and the steps
// fulfilling it; a step and its chain), else to the row's own box in that column; In opens a box and steps to its first
// child; Out steps to its parent, and on a cell's own box closes it. From no box (the product, or a record the view does
// not draw) any move goes to the first row's use case. TraceView.tsx moves the focus or the ring.

/** What each step button does, for its name and tooltip. */
export const TRACE_WALK_LABELS: Record<Move, string> = {
  left: 'Step along the row to the nearest linked box on the left',
  right: 'Step along the row to the nearest linked box on the right',
  up: 'Step to the box above in its column',
  down: 'Step to the box below in its column',
  out: 'Out to the box this one is in, or close it',
  in: 'In to the first child, opening the box',
};

/** Where a move goes: the box, and the key to open or close on the way (In and Out). */
export interface WalkTo { to: string; toggle?: string }

/** Where a move goes from a box (null for none), or null. */
export function traceTarget(graph: TraceGraph, laid: TraceLaid, o: Openness, at: string | null, move: Move): WalkTo | null {
  const item = at && laid.places.has(at) ? graph.items.get(at) : undefined;
  if (!item || !at) {
    const first = laid.columns[1][0] ?? laid.columns[0][0];
    return first ? { to: first } : null;
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
  if (next < 0 || next > 4) return null;
  const y = laid.places.get(at)!.y;
  const nearest = (keys: readonly string[]) => keys.filter((k) => laid.places.has(k)).sort((a, b) => Math.abs(laid.places.get(a)!.y - y) - Math.abs(laid.places.get(b)!.y - y))[0];
  // From an outcome: the use cases it serves; to an outcome: those its row serves.
  if (item.column === 0) { const to = nearest(graph.serves.filter(([oc]) => `outcome/${oc}` === at).map(([, u]) => `${u}|use-case`)); return to ? { to } : null; }
  const row = item.row ? graph.rowOf.get(item.row) : undefined;
  if (!row) return null;
  if (next === 0) { const to = nearest(row.data.outcomes.map((oc) => `outcome/${oc}`)); return to ? { to } : null; }
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
  return `${item.words?.title ?? key}, ${TRACE_COLUMN_LABELS[TRACE_COLUMNS[item.column]]}`;
}
