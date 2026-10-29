import type { SpecIndex } from '../specs/data';
import { stepName } from '../graph/steps';
import { nearestBox, type Direction, type StageLevels } from '../views/levels';
import { drawnLane, LANE_COLUMNS, LANE_COLUMN_LABELS, visibleIn, type LaneColumn, type TraceBox, type TraceMap } from './lanes';

// The Trace stage's walk (LA-V61-R49, LA-V98-R13): the stage walk's levels (views/levels.ts) over the map as drawn, not
// the record tree: the product, its bands (a domain, the Shared folder, the Untraced lane), each band's lanes, each
// lane's boxes, and under a "+N more" box the boxes it hides. Out goes to the lane or band around, In to the first thing
// inside it (a "+N more" opening at the first box it hides). Among lanes an arrow goes to the nearest lane that way in
// the band. Among boxes Right goes one step along the lane (obligation → flow → step → design → build → tests → files),
// Left one step back and, past the obligation, into the why tree (its parent or use case → capability → outcome); a tree
// box's Right goes back down to the lane the walk came from. Up and Down go to the box directly above or below in the
// same column: the next box of a stacked cell, then the same column in the neighboring lane (down one column of lanes
// and on at the top of the next), a "+N more" box among them, which Right (or In, or Enter) opens. Where a lane or a
// column ends, the walk goes on to the next lane's first box (levels.ts). A record shared by several lanes keeps the lane
// the walk arrived on. Pure and tested directly; TraceView.tsx moves the focus.

/** Where the walk is on the boxes: a box (its key), and the lane it arrived on (a tree box spans several; null when it came from none). */
export interface TraceAt { key: string; lane: number | null }

/** A node of the walk's levels: the product, `band:<n>`, `lane:<n>`, or a box in the lane it was reached in, `box:<lane>:<key>`. */
export const bandNode = (band: number) => `band:${band}`;
export const laneNode = (lane: number) => `lane:${lane}`;
export const boxNode = (at: TraceAt) => `box:${at.lane ?? '-'}:${at.key}`;
/** What a node of the levels is. */
export type TraceNode = { level: 'product' } | { level: 'band'; band: number } | { level: 'lane'; lane: number } | { level: 'box'; at: TraceAt };
export function traceNode(map: TraceMap, node: string): TraceNode | null {
  if (node === map.product) return { level: 'product' };
  const band = /^band:(\d+)$/.exec(node);
  if (band) return { level: 'band', band: Number(band[1]) };
  const lane = /^lane:(\d+)$/.exec(node);
  if (lane) return { level: 'lane', lane: Number(lane[1]) };
  const box = /^box:(-|\d+):(.*)$/s.exec(node);
  if (box && map.byKey.has(box[2])) return { level: 'box', at: { key: box[2], lane: box[1] === '-' ? null : Number(box[1]) } };
  return null;
}

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
 * Where an arrow goes from a box on the map, drawn with the `open` lane open; null where the lane or the column ends.
 * Returns the box and the lane the walk is then on.
 */
export function traceStep(map: TraceMap, at: TraceAt, direction: Direction, open: number | null): TraceAt | null {
  const box = map.byKey.get(at.key);
  if (!box) return null;
  const to = (b: TraceBox | undefined, lane = b && b.lane >= 0 ? b.lane : at.lane): TraceAt | null => (b ? { key: b.key, lane } : null);
  if (direction === 'up' || direction === 'down') {
    const column = drawnColumns(map, open).get(box.column) ?? [];
    const i = column.indexOf(box);
    if (i < 0) return null;
    return to(column[i + (direction === 'down' ? 1 : -1)]);
  }
  const right = direction === 'right';
  // A tree box: Left to its parent; Right to its child over the lane the walk came from, else its first.
  if (box.lane < 0) {
    if (!right) return to(map.byKey.get(map.tree.lines.find((l) => l.to === box.key)?.from ?? ''));
    const children = map.tree.lines.filter((l) => l.from === box.key).map((l) => map.byKey.get(l.to)!);
    const over = (c: TraceBox) => { const [a, z] = map.places.get(c.key) ?? [-1, -1]; return at.lane !== null && at.lane >= a && at.lane <= z; };
    return to(children.find(over) ?? children[0]);
  }
  // A "+N more": Right opens it, at the first box it hides.
  if (box.role === 'more') return right ? to(hiddenBy(map, box)[0]) : sideways(map, box, false, open, to);
  return sideways(map, box, right, open, to);
}

/** The boxes a "+N more" box hides: the rest of its column in its lane's open form, top to bottom. */
function hiddenBy(map: TraceMap, more: TraceBox): TraceBox[] {
  const lane = map.lanes[more.lane];
  return (lane.open?.boxes ?? []).filter((b) => b.column === more.column && !lane.boxes.includes(b)).sort((a, b) => a.y - b.y);
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

const levelsCache = new WeakMap<TraceMap, Map<number | null, StageLevels>>();

/** The map as the walk's levels, drawn with the `open` lane open: product › band › lane › box › the boxes a "+N more" hides. */
export function traceLevels(map: TraceMap, open: number | null): StageLevels {
  let byOpen = levelsCache.get(map);
  if (!byOpen) { byOpen = new Map(); levelsCache.set(map, byOpen); }
  const known = byOpen.get(open);
  if (known) return known;
  const column = (b: TraceBox) => LANE_COLUMNS.indexOf(b.column);
  const laneRect = (n: number) => { const l = map.lanes[n]; return { x: l.left, y: l.top, width: l.right - l.left, height: l.height }; };
  const isHidden = (b: TraceBox) => b.lane >= 0 && !map.lanes[b.lane].boxes.includes(b);
  const moreOver = (b: TraceBox) => map.lanes[b.lane].boxes.find((m) => m.role === 'more' && m.column === b.column);
  const levels: StageLevels = {
    root: map.product,
    parent: (id) => {
      const node = traceNode(map, id);
      if (!node || node.level === 'product') return null;
      if (node.level === 'band') return map.product;
      if (node.level === 'lane') return bandNode(map.lanes[node.lane].band);
      const box = map.byKey.get(node.at.key)!;
      if (box.lane < 0) {
        // A tree box sits over the lanes beneath it: its lane is the one the walk came from, else the first beneath it.
        const lane = node.at.lane ?? map.places.get(box.key)?.[0] ?? null;
        return lane === null ? null : laneNode(lane);
      }
      const more = isHidden(box) ? moreOver(box) : undefined;
      return more ? boxNode({ key: more.key, lane: box.lane }) : laneNode(box.lane);
    },
    children: (id) => {
      const node = traceNode(map, id);
      if (!node) return [];
      if (node.level === 'product') return map.bands.map((_, i) => bandNode(i));
      if (node.level === 'band') {
        const band = map.bands[node.band];
        return Array.from({ length: band.to - band.from }, (_, i) => laneNode(band.from + i));
      }
      if (node.level === 'lane') {
        const lane = node.lane;
        return [...map.lanes[lane].boxes].sort((a, b) => column(a) - column(b) || a.y - b.y).map((b) => boxNode({ key: b.key, lane }));
      }
      const box = map.byKey.get(node.at.key)!;
      // A tree box holds what hangs from it, toward the lane the walk came from: In goes where Right does.
      if (box.lane < 0) { const to = traceStep(map, node.at, 'right', open); return to ? [boxNode(to)] : []; }
      return box.role === 'more' ? hiddenBy(map, box).map((b) => boxNode({ key: b.key, lane: box.lane })) : [];
    },
    across: (id, direction) => {
      const node = traceNode(map, id);
      if (!node || node.level === 'product') return null;
      if (node.level === 'band') {
        const next = node.band + (direction === 'right' || direction === 'down' ? 1 : -1);
        return next >= 0 && next < map.bands.length ? bandNode(next) : null;
      }
      if (node.level === 'lane') {
        const band = map.bands[map.lanes[node.lane].band];
        const siblings = Array.from({ length: band.to - band.from }, (_, i) => band.from + i).filter((n) => n !== node.lane).map((n) => ({ id: laneNode(n), rect: laneRect(n) }));
        return nearestBox(laneRect(node.lane), siblings, direction);
      }
      const to = traceStep(map, node.at, direction, open);
      return to ? boxNode(to) : null;
    },
  };
  byOpen.set(open, levels);
  return levels;
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
    case 'more': return `${box.words!.title} in ${LANE_COLUMN_LABELS[box.column]}: Right, In or Enter shows them`;
    case 'gap': { const obligation = box.id.split(':')[1]; return `${box.words!.title}, a gap of ${index.byId.get(obligation)?.title ?? obligation}`; }
    case 'file': return `File ${box.words!.title}`;
    case 'untraced': return `Untraced, ${box.words!.meta}`;
    case 'record': return stepName(index, box.id);
  }
}

/** What the walk says on a band or a lane: "Lending, 12 lanes", "The lane of Lend a thing". */
export function levelWords(index: SpecIndex, map: TraceMap, node: TraceNode): string {
  if (node.level === 'band') { const b = map.bands[node.band]; return `${b.label}, ${b.to - b.from} ${b.to - b.from === 1 ? 'lane' : 'lanes'}`; }
  if (node.level === 'lane') { const o = map.lanes[node.lane].obligation; return o ? `The lane of ${index.byId.get(o)?.title ?? o}` : 'The Untraced lane'; }
  if (node.level === 'product') return stepName(index, map.product);
  return boxWords(index, map.byKey.get(node.at.key)!);
}
