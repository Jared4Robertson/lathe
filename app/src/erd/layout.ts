import type { ElkNode } from 'elkjs/lib/elk-api';
import { elkLayout } from '../elk';
import { BOUNDARY_PAD, boxSize, type Erd, type ErdBox, type Rect } from './erd';

// Lays out an ERD with ELK's layered algorithm, in two passes. First each aggregate's boundary: its
// entities, the root first, along their has one and has many lines, left to right or top to bottom,
// whichever comes nearer the canvas's shape. Then the diagram: each boundary at the size its entities
// take, and the closed aggregate boxes, left to right along the references between them, wrapped to
// about the canvas's shape. The diagram's own boxes come first in model order and the faded context
// after them, so the same diagram always gets the same picture.

type Direction = 'RIGHT' | 'DOWN';

const layered = (direction: Direction) => ({
  'elk.algorithm': 'layered',
  'elk.direction': direction,
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
});

/** One boundary's inside: its entities and the lines between them. */
export function boundaryGraph(erd: Erd, aggregate: string, direction: Direction): ElkNode {
  const members = erd.boxes.filter((b) => b.parent === aggregate);
  const ids = new Set(members.map((b) => b.id));
  return {
    id: aggregate,
    layoutOptions: { ...layered(direction), 'elk.layered.spacing.nodeNodeBetweenLayers': '40', 'elk.spacing.nodeNode': '16', 'elk.spacing.componentComponent': '20', 'elk.padding': '[top=0,left=0,bottom=0,right=0]' },
    children: members.map((b) => ({ id: b.id, ...boxSize(b) })),
    edges: erd.lines.filter((l) => ids.has(l.source) && ids.has(l.target)).map((l, i) => ({ id: `e${i}`, sources: [l.source], targets: [l.target] })),
  };
}

/** The diagram's top level: the boundaries at their given sizes, the closed boxes, and the references between them. */
export function erdGraph(erd: Erd, sizes: ReadonlyMap<string, { width: number; height: number }>, aspect = 1.6): ElkNode {
  const top = erd.boxes.filter((b) => !b.parent);
  const ordered = [...top.filter((b) => !b.context), ...top.filter((b) => b.context)];
  const ownerOf = new Map(erd.boxes.map((b) => [b.id, b.parent ?? b.id]));
  const pairs = new Map<string, { sources: string[]; targets: string[] }>();
  for (const l of erd.lines) {
    const [s, t] = [ownerOf.get(l.source) ?? l.source, ownerOf.get(l.target) ?? l.target];
    if (s !== t) pairs.set(`${s}|${t}`, { sources: [s], targets: [t] });
  }
  return {
    id: 'root',
    layoutOptions: {
      ...layered('RIGHT'),
      'elk.layered.spacing.nodeNodeBetweenLayers': '56',
      'elk.spacing.nodeNode': '20',
      'elk.spacing.componentComponent': '32',
      // A diagram wider than the canvas's shape wraps its layers into rows, read left to right then down.
      'elk.aspectRatio': String(Math.round(aspect * 100) / 100),
      'elk.layered.wrapping.strategy': 'MULTI_EDGE',
      'elk.layered.wrapping.additionalEdgeSpacing': '10',
    },
    children: ordered.map((b) => ({ id: b.id, ...(sizes.get(b.id) ?? boxSize(b)) })),
    edges: [...pairs.values()].map((e, i) => ({ id: `e${i}`, ...e })),
  };
}

/** How far a layout's shape is from the canvas's: 0 when they match. */
const misfit = (laid: ElkNode, aspect: number) => Math.abs(Math.log(Math.max(1, laid.width ?? 1) / Math.max(1, laid.height ?? 1) / aspect));

/** A boundary's inside laid out both ways, the one nearer the canvas's shape kept (left to right on a tie). */
async function layoutBoundary(erd: Erd, aggregate: string, aspect: number): Promise<ElkNode> {
  const [right, down] = await Promise.all([elkLayout(boundaryGraph(erd, aggregate, 'RIGHT')), elkLayout(boundaryGraph(erd, aggregate, 'DOWN'))]);
  return misfit(down, aspect) < misfit(right, aspect) ? down : right;
}

const isBoundary = (b: ErdBox) => b.kind === 'aggregate' && b.boundary;

/** Each box's place and size on the canvas: a boundary's, and each entity's inside it. */
export async function layoutErd(erd: Erd, aspect = 1.6): Promise<Map<string, Rect>> {
  const out = new Map<string, Rect>();
  if (erd.boxes.length === 0) return out;
  const boundaries = erd.boxes.filter(isBoundary);
  const inner = await Promise.all(boundaries.map((b) => (erd.boxes.some((m) => m.parent === b.id) ? layoutBoundary(erd, b.id, aspect) : Promise.resolve(null))));
  const sizes = new Map<string, { width: number; height: number }>();
  boundaries.forEach((b, i) => {
    const laid = inner[i];
    const closed = boxSize(b);
    if (!laid) { sizes.set(b.id, closed); return; }
    sizes.set(b.id, {
      width: Math.max(closed.width, Math.round(laid.width ?? 0) + 2 * BOUNDARY_PAD.side),
      height: Math.round(laid.height ?? 0) + BOUNDARY_PAD.top + BOUNDARY_PAD.bottom,
    });
  });
  const laid = await elkLayout(erdGraph(erd, sizes, aspect));
  for (const c of laid.children ?? []) out.set(c.id, { x: Math.round(c.x ?? 0), y: Math.round(c.y ?? 0), width: c.width ?? 0, height: c.height ?? 0 });
  boundaries.forEach((b, i) => {
    const at = out.get(b.id);
    if (!at) return;
    for (const c of inner[i]?.children ?? []) {
      out.set(c.id, { x: at.x + BOUNDARY_PAD.side + Math.round(c.x ?? 0), y: at.y + BOUNDARY_PAD.top + Math.round(c.y ?? 0), width: c.width ?? 0, height: c.height ?? 0 });
    }
  });
  return out;
}
