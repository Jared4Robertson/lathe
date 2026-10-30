import type { ElkNode } from 'elkjs/lib/elk-api';
import { elkLayout } from '../elk';
import { BOUNDARY_PAD, boxSize, type ErdBox, type ErdMap, type Rect } from './erd';
import { keepPlaces } from '../graph/keep-places';

// Lays out a product's ERD map with ELK's layered algorithm, once for what it reads (a new answer of the ERD read that
// changes no box, title, field count or line lays nothing out again): the layout is cached by that (LA-PAT-APP-UX-R19), so every focus and stage switch on the same
// data reads the same places (LA-V94-R08).
// Three passes, from the inside out. First each aggregate's boundary: its entities, the root first,
// along their has one and has many lines, left to right or top to bottom, whichever comes nearer
// the map's shape. Then each domain's region: its aggregates at the size their entities take, left
// to right along the references between them, its layers wrapped into rows or its unconnected parts
// packed side by side, whichever comes nearer the map's shape (a large domain whose layers wrap
// stands taller than wide). Then the product:
// the regions, along the references between domains. Each level keeps model order, so the same
// data always gets the same picture.
//
// New data moves only what it changed (LA-PAT-APP-UX-R22): laid out after a layout of the same product, each region and
// the product's top level keep their boxes where they were (graph/keep-places.ts, as the Graph's Map does). A boundary is laid out again inside only by
// what it holds (ELK gives the same picture for the same inside); a box that grew pushes right or down only the boxes it
// now overlaps, and those push theirs; a new box goes beside what is there; a removed one leaves its room. Only Tidy up
// (`tidyErdLayout`) lays the whole map out afresh.

type Direction = 'RIGHT' | 'DOWN';
type Size = { width: number; height: number };
/** How a level wraps: its layers into rows, or not at all. */
type Wrap = 'MULTI_EDGE' | 'OFF';

/** The shape every level wraps to: about a wide screen's. */
const ASPECT = 1.6;

const layered = (direction: Direction) => ({
  'elk.algorithm': 'layered',
  'elk.direction': direction,
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
});

/** The box under `group` that holds `id` (itself when it is a child of `group`), or undefined when `id` lies outside it. */
function childOf(parents: ReadonlyMap<string, string | undefined>, group: string | undefined, id: string): string | undefined {
  for (let at: string | undefined = id; at; at = parents.get(at)) if (parents.get(at) === group) return at;
  return undefined;
}

/** One boundary's inside: its entities and the lines between them. */
export function boundaryGraph(map: ErdMap, aggregate: string, direction: Direction): ElkNode {
  const members = map.boxes.filter((b) => b.parent === aggregate);
  const ids = new Set(members.map((b) => b.id));
  return {
    id: aggregate,
    layoutOptions: { ...layered(direction), 'elk.layered.spacing.nodeNodeBetweenLayers': '40', 'elk.spacing.nodeNode': '16', 'elk.spacing.componentComponent': '20', 'elk.padding': '[top=0,left=0,bottom=0,right=0]' },
    children: members.map((b) => ({ id: b.id, ...boxSize(b) })),
    edges: map.lines.filter((l) => ids.has(l.source) && ids.has(l.target)).map((l, i) => ({ id: `e${i}`, sources: [l.source], targets: [l.target] })),
  };
}

/**
 * A region's inside, or the product's top level (`group` undefined): its boxes at their given sizes,
 * and one edge for each pair of them a line joins, read through the boxes that hold the line's ends.
 */
export function groupGraph(map: ErdMap, group: string | undefined, sizes: ReadonlyMap<string, Size>, wrap: Wrap = 'MULTI_EDGE'): ElkNode {
  const members = map.boxes.filter((b) => b.parent === group);
  const parents = new Map(map.boxes.map((b) => [b.id, b.parent]));
  const pairs = new Map<string, { sources: string[]; targets: string[] }>();
  for (const l of map.lines) {
    const [s, t] = [childOf(parents, group, l.source), childOf(parents, group, l.target)];
    if (s && t && s !== t) pairs.set(`${s}|${t}`, { sources: [s], targets: [t] });
  }
  return {
    id: group ?? 'root',
    layoutOptions: {
      ...layered('RIGHT'),
      'elk.layered.spacing.nodeNodeBetweenLayers': group ? '56' : '80',
      'elk.spacing.nodeNode': group ? '20' : '40',
      'elk.spacing.componentComponent': group ? '32' : '56',
      'elk.padding': '[top=0,left=0,bottom=0,right=0]',
      // A level wider than the map's shape wraps its layers into rows, read left to right then down
      // (`MULTI_EDGE`); unwrapped (`OFF`), its unconnected parts are packed to about the map's shape.
      'elk.aspectRatio': String(ASPECT),
      'elk.layered.wrapping.strategy': wrap,
      'elk.layered.wrapping.additionalEdgeSpacing': '10',
    },
    children: members.map((b) => ({ id: b.id, ...(sizes.get(b.id) ?? boxSize(b)) })),
    edges: [...pairs.values()].map((e, i) => ({ id: `e${i}`, ...e })),
  };
}

/** How far a layout's shape is from the map's: 0 when they match. */
const misfit = (laid: ElkNode) => Math.abs(Math.log(Math.max(1, laid.width ?? 1) / Math.max(1, laid.height ?? 1) / ASPECT));

/** A boundary's inside laid out both ways, the one nearer the map's shape kept (left to right on a tie). */
async function layoutBoundary(map: ErdMap, aggregate: string): Promise<ElkNode> {
  const [right, down] = await Promise.all([elkLayout(boundaryGraph(map, aggregate, 'RIGHT')), elkLayout(boundaryGraph(map, aggregate, 'DOWN'))]);
  return misfit(down) < misfit(right) ? down : right;
}

/** A region's inside laid out wrapped and unwrapped, the one nearer the map's shape kept (wrapped on a tie). */
export async function layoutRegion(map: ErdMap, domain: string, sizes: ReadonlyMap<string, Size>): Promise<ElkNode> {
  const [wrapped, packed] = await Promise.all([elkLayout(groupGraph(map, domain, sizes, 'MULTI_EDGE')), elkLayout(groupGraph(map, domain, sizes, 'OFF'))]);
  return misfit(packed) < misfit(wrapped) ? packed : wrapped;
}

/** A region's size around its laid-out inside: its head on top, a gap on the other sides; a closed box when it holds nothing. */
const around = (box: ErdBox, laid: ElkNode | null): Size => {
  const closed = boxSize(box);
  if (!laid || (laid.children ?? []).length === 0) return closed;
  return {
    width: Math.max(closed.width, Math.round(laid.width ?? 0) + 2 * BOUNDARY_PAD.side),
    height: Math.round(laid.height ?? 0) + BOUNDARY_PAD.top + BOUNDARY_PAD.bottom,
  };
};

/** The gap a pushed box keeps from the box that pushed it: a region's between its aggregates, the product's between its regions. */
const REGION_GAP = 20;
const TOP_GAP = 40;

/** Where a box lay inside its parent in a layout before: its place from its parent's inside's corner (the map's for the top level). */
function placeBefore(before: ReadonlyMap<string, Rect>, parent: string | undefined) {
  const p = parent ? before.get(parent) : undefined;
  if (parent && !p) return () => undefined;
  const ox = p ? p.x + BOUNDARY_PAD.side : 0;
  const oy = p ? p.y + BOUNDARY_PAD.top : 0;
  return (id: string): Rect | undefined => { const r = before.get(id); return r && { ...r, x: r.x - ox, y: r.y - oy }; };
}

/**
 * Each box's place and size on the map: every region's, every boundary's, and each entity's inside its boundary. With
 * `before`, a layout of the same product drawn before, each region and the top level keep their boxes where they were
 * (`keepPlaces`); without it, the whole map is laid out afresh.
 */
export async function layoutErd(map: ErdMap, before?: ReadonlyMap<string, Rect>): Promise<Map<string, Rect>> {
  const out = new Map<string, Rect>();
  if (map.boxes.length === 0) return out;
  const sizes = new Map<string, Size>();
  const inner = new Map<string, ElkNode>();
  const aggregates = map.boxes.filter((b) => b.kind === 'aggregate');
  const laidAggregates = await Promise.all(aggregates.map((a) => (a.empty ? Promise.resolve(null) : layoutBoundary(map, a.id))));
  aggregates.forEach((a, i) => { const laid = laidAggregates[i]; sizes.set(a.id, around(a, laid)); if (laid) inner.set(a.id, laid); });
  /** A level kept where it was before, or null to lay it out afresh. */
  const kept = (group: string | undefined, gap: number) => {
    if (!before) return null;
    const members = map.boxes.filter((b) => b.parent === group).map((b) => ({ id: b.id, ...(sizes.get(b.id) ?? boxSize(b)) }));
    return keepPlaces(members, placeBefore(before, group), { gap, aspect: ASPECT });
  };
  const domains = map.boxes.filter((b) => b.kind === 'domain');
  const laidDomains = await Promise.all(domains.map((d) => (d.empty ? Promise.resolve(null) : kept(d.id, REGION_GAP) ?? layoutRegion(map, d.id, sizes))));
  domains.forEach((d, i) => { const laid = laidDomains[i]; sizes.set(d.id, around(d, laid)); if (laid) inner.set(d.id, laid); });
  const top = kept(undefined, TOP_GAP) ?? await elkLayout(groupGraph(map, undefined, sizes));
  // From the top down: each box's place, then its inside's from its corner.
  const place = (laid: ElkNode, at: { x: number; y: number }) => {
    for (const c of laid.children ?? []) {
      const r = { x: at.x + Math.round(c.x ?? 0), y: at.y + Math.round(c.y ?? 0), width: c.width ?? 0, height: c.height ?? 0 };
      out.set(c.id, r);
      const inside = inner.get(c.id);
      if (inside) place(inside, { x: r.x + BOUNDARY_PAD.side, y: r.y + BOUNDARY_PAD.top });
    }
  };
  place(top, { x: 0, y: 0 });
  return out;
}

// ---------- Once per change to what it reads ----------

interface Laying { promise: Promise<Map<string, Rect>>; rects?: Map<string, Rect> }

/**
 * What a map's layout reads: each box's place in the tree, kind, title, root mark and fields (its size), and the lines'
 * ends. Two answers that agree on it lay out alike, so new data that changes none of it (a reload of other tables, a
 * description edited) lays nothing out again (LA-PAT-APP-UX-R19).
 */
const layoutKey = (map: ErdMap) => JSON.stringify([
  map.boxes.map((b) => [b.id, b.parent ?? '', b.kind, b.title, b.root ? 1 : 0, b.empty ? 1 : 0, b.fields.length]),
  map.lines.map((l) => [l.source, l.target]),
]);

/** Each map laid out (in ELK's worker), once for what it reads however many answers bring it; the latest few kept. */
const laid = new Map<string, Laying>();
const byAnswer = new WeakMap<ErdMap, Laying>();
const KEEP = 4;
/** Each product's layout laid out last, the one new data keeps its places from (LA-PAT-APP-UX-R22). */
const latest = new Map<string, Laying>();

function remember(map: ErdMap, key: string, laying: Laying) {
  laid.delete(key);
  laid.set(key, laying);
  if (laid.size > KEEP) laid.delete(laid.keys().next().value!);
  byAnswer.set(map, laying);
  latest.set(map.product, laying);
}

/** A map laid out, from the product's layout before once it has arrived (kept where it was), or afresh. */
function start(map: ErdMap, key: string, before: Laying | undefined): Laying {
  const was = before ? before.promise.catch(() => undefined) : Promise.resolve(undefined);
  const next: Laying = { promise: was.then((rects) => layoutErd(map, rects)) };
  next.promise.then((rects) => { next.rects = rects; }, () => { if (laid.get(key) === next) laid.delete(key); });
  return next;
}

function layingOut(map: ErdMap): Laying {
  const known = byAnswer.get(map);
  if (known) return known;
  const key = layoutKey(map);
  const laying = laid.get(key) ?? start(map, key, latest.get(map.product));
  remember(map, key, laying);
  return laying;
}

/** A map's layout if it has arrived, so a stage switch on the same data draws the map framed at once. */
export const readyErdLayout = (map: ErdMap): Map<string, Rect> | undefined => layingOut(map).rects;

/** A map's layout: laid out once for what it reads, then read. */
export const erdLayout = (map: ErdMap): Promise<Map<string, Rect>> => layingOut(map).promise;

/** Tidy up (LA-V94-R09): the whole map laid out afresh, its order worked out again, the layout every later change keeps its places from. */
export function tidyErdLayout(map: ErdMap): Promise<Map<string, Rect>> {
  const key = layoutKey(map);
  const laying = start(map, key, undefined);
  remember(map, key, laying);
  return laying.promise;
}
