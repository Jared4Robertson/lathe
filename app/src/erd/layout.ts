import type { ElkNode } from 'elkjs/lib/elk-api';
import { elkLayout } from '../elk';
import { BOUNDARY_PAD, boxSize, type ErdBox, type ErdMap, type Rect } from './erd';

// Lays out a product's ERD map with ELK's layered algorithm, once per answer of the ERD read (a new one comes with each
// data change): the layout is cached by the answer (LA-PAT-APP-UX-R19), so every focus and stage switch on the same
// data reads the same places (LA-V94-R08).
// Three passes, from the inside out. First each aggregate's boundary: its entities, the root first,
// along their has one and has many lines, left to right or top to bottom, whichever comes nearer
// the map's shape. Then each domain's region: its aggregates at the size their entities take, left
// to right along the references between them, its layers wrapped into rows or its unconnected parts
// packed side by side, whichever comes nearer the map's shape (a large domain whose layers wrap
// stands taller than wide). Then the product:
// the regions, along the references between domains. Each level keeps model order, so the same
// data always gets the same picture.

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

/** Each box's place and size on the map: every region's, every boundary's, and each entity's inside its boundary. */
export async function layoutErd(map: ErdMap): Promise<Map<string, Rect>> {
  const out = new Map<string, Rect>();
  if (map.boxes.length === 0) return out;
  const sizes = new Map<string, Size>();
  const inner = new Map<string, ElkNode>();
  const aggregates = map.boxes.filter((b) => b.kind === 'aggregate');
  const laidAggregates = await Promise.all(aggregates.map((a) => (a.empty ? Promise.resolve(null) : layoutBoundary(map, a.id))));
  aggregates.forEach((a, i) => { const laid = laidAggregates[i]; sizes.set(a.id, around(a, laid)); if (laid) inner.set(a.id, laid); });
  const domains = map.boxes.filter((b) => b.kind === 'domain');
  const laidDomains = await Promise.all(domains.map((d) => (d.empty ? Promise.resolve(null) : layoutRegion(map, d.id, sizes))));
  domains.forEach((d, i) => { const laid = laidDomains[i]; sizes.set(d.id, around(d, laid)); if (laid) inner.set(d.id, laid); });
  const top = await elkLayout(groupGraph(map, undefined, sizes));
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

// ---------- Once per answer ----------

interface Laying { promise: Promise<Map<string, Rect>>; rects?: Map<string, Rect> }

/** Each map laid out (in ELK's worker), once per answer of the ERD read however many ask; its places kept once they arrive. */
const laid = new WeakMap<ErdMap, Laying>();

function layingOut(map: ErdMap): Laying {
  let laying = laid.get(map);
  if (!laying) {
    const next: Laying = { promise: layoutErd(map) };
    next.promise.then((rects) => { next.rects = rects; }, () => {});
    laid.set(map, next);
    laying = next;
  }
  return laying;
}

/** A map's layout if it has arrived, so a stage switch on the same data draws the map framed at once. */
export const readyErdLayout = (map: ErdMap): Map<string, Rect> | undefined => layingOut(map).rects;

/** A map's layout: laid out once per answer (each data change), then read. */
export const erdLayout = (map: ErdMap): Promise<Map<string, Rect>> => layingOut(map).promise;
