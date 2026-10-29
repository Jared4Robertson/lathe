import type { SpecIndex } from '../specs/data';
import { stepName } from '../graph/steps';
import { drawnLane, LANE_COLUMNS, LANE_COLUMN_LABELS, visibleIn, type LaneColumn, type TraceBox, type TraceMap } from './lanes';

// The Trace stage's walk (LA-V61-R49, LA-V98-R13): the plain arrow keys move over the map as drawn, not through the
// record tree. Right goes one step along the lane (obligation → flow → step → design → build → tests → files), Left
// one step back and, past the obligation, into the why tree (its parent or use case → capability → outcome); a tree
// box's Right goes back down to the lane the walk came from. Up and Down go to the box directly above or below in the
// same column: the next box of a stacked cell, then the same column in the neighboring lane (down one column of lanes
// and on at the top of the next), a "+N more" box among them, which Right (or Enter) opens. A record shared by several
// lanes keeps the lane the walk arrived on. Pure and tested directly; TraceView.tsx moves the focus.

/** Where the walk is: a box (its key), and the lane it arrived on (a tree box spans several; null when it came from none). */
export interface TraceAt { key: string; lane: number | null }

const BIG = Infinity;
const ALL = { x0: -BIG, y0: -BIG, x1: BIG, y1: BIG };

/** Each column's boxes as drawn with a lane open, in reading order: down each column of lanes, then the next. */
const columnsCache = new WeakMap<TraceMap, Map<number | null, Map<LaneColumn, TraceBox[]>>>();
function drawnColumns(map: TraceMap, open: number | null): Map<LaneColumn, TraceBox[]> {
  let byOpen = columnsCache.get(map);
  if (!byOpen) { byOpen = new Map(); columnsCache.set(map, byOpen); }
  const known = byOpen.get(open);
  if (known) return known;
  const columns = new Map<LaneColumn, TraceBox[]>();
  for (const b of visibleIn(map, ALL, open).boxes) {
    const list = columns.get(b.column);
    if (list) list.push(b); else columns.set(b.column, [b]);
  }
  for (const list of columns.values()) list.sort((a, b) => a.x - b.x || a.y - b.y);
  byOpen.set(open, columns);
  return columns;
}

/** The box nearest another down the page, the first of a tie. */
const nearest = (boxes: readonly TraceBox[], y: number) => boxes.reduce((best, b) => (Math.abs(b.y - y) < Math.abs(best.y - y) ? b : best));

/**
 * Where an arrow key goes from a box on the map, drawn with the `open` lane open; null where there is nowhere to go.
 * Returns the box and the lane the walk is then on.
 */
export function traceStep(map: TraceMap, at: TraceAt, key: string, open: number | null): TraceAt | null {
  const box = map.byKey.get(at.key);
  if (!box) return null;
  const to = (b: TraceBox | undefined, lane = b && b.lane >= 0 ? b.lane : at.lane): TraceAt | null => (b ? { key: b.key, lane } : null);
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const column = drawnColumns(map, open).get(box.column) ?? [];
    const i = column.indexOf(box);
    if (i < 0) return null;
    return to(column[i + (key === 'ArrowDown' ? 1 : -1)]);
  }
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null;
  const right = key === 'ArrowRight';
  // A tree box: Left to its parent; Right to its child over the lane the walk came from, else its first.
  if (box.lane < 0) {
    if (!right) return to(map.byKey.get(map.tree.lines.find((l) => l.to === box.key)?.from ?? ''));
    const children = map.tree.lines.filter((l) => l.from === box.key).map((l) => map.byKey.get(l.to)!);
    const over = (c: TraceBox) => { const [a, z] = map.places.get(c.key) ?? [-1, -1]; return at.lane !== null && at.lane >= a && at.lane <= z; };
    return to(children.find(over) ?? children[0]);
  }
  // A "+N more": Right opens it, at the first box it hides.
  if (box.role === 'more') return right ? to(map.lanes[box.lane].open?.boxes.find((b) => b.column === box.column && !map.lanes[box.lane].boxes.includes(b))) : sideways(map, box, false, open, to);
  return sideways(map, box, right, open, to);
}

/**
 * The record the focus moves to when the walk lands on a box: a record's own; for a box that is no record, none (the
 * ring moves alone), unless it is hidden in a lane that is not open (a "+N more" just opened), when the record it
 * opens (a file's first naming record) or its lane's obligation, so its lane opens.
 */
export function focusOf(map: TraceMap, at: TraceAt, open: number | null): string | null {
  const box = map.byKey.get(at.key);
  if (!box) return null;
  if (box.role === 'record') return box.id;
  if (box.lane < 0 || box.lane === open || map.lanes[box.lane].boxes.includes(box)) return null;
  return box.opens ?? map.lanes[box.lane].obligation;
}

/** One column along a lane: to a box the arrows join to this one, else the nearest; Left from the obligation into the tree. */
function sideways(map: TraceMap, box: TraceBox, right: boolean, open: number | null, to: (b: TraceBox | undefined) => TraceAt | null): TraceAt | null {
  const lane = map.lanes[box.lane];
  const drawn = drawnLane(lane, box.lane === open);
  const from = LANE_COLUMNS.indexOf(box.column);
  const step = right ? 1 : -1;
  for (let c = from + step; c >= 0 && c < LANE_COLUMNS.length; c += step) {
    const candidates = drawn.boxes.filter((b) => b.column === LANE_COLUMNS[c]);
    if (candidates.length === 0) continue;
    const joined = drawn.lines.filter((l) => (right ? l.from === box.key : l.to === box.key)).map((l) => (right ? l.to : l.from));
    return to(candidates.find((b) => joined.includes(b.key)) ?? nearest(candidates, box.y));
  }
  if (right) return null;
  // Past the obligation: the tree box it hangs from.
  return to(map.byKey.get(map.tree.lines.find((l) => l.to === box.key)?.from ?? ''));
}

/** Where the walk starts on a focus with no box of its own (a product, a domain): its first kept lane's obligation, else the map's first. */
export function startOf(map: TraceMap, lanes: ReadonlySet<number> | null): TraceAt | null {
  const first = lanes && lanes.size > 0 ? Math.min(...lanes) : 0;
  const box = map.lanes[first]?.boxes.find((b) => b.column === 'obligation');
  return box ? { key: box.key, lane: first } : null;
}

/** What the walk says on a box that is no record: "+12 more in Build", "Not built, a gap of Lend a thing", "File src/lend.ts". */
export function boxWords(index: SpecIndex, box: TraceBox): string {
  switch (box.role) {
    case 'more': return `${box.words!.title} in ${LANE_COLUMN_LABELS[box.column]}: Right or Enter shows them`;
    case 'gap': { const obligation = box.id.split(':')[1]; return `${box.words!.title}, a gap of ${index.byId.get(obligation)?.title ?? obligation}`; }
    case 'file': return `File ${box.words!.title}`;
    case 'untraced': return `Untraced, ${box.words!.meta}`;
    case 'record': return stepName(index, box.id);
  }
}
