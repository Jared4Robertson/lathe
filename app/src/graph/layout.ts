import { PARENT, type Neighborhood } from './model';

// Lays out the graph in columns, left to right: by depth in the parent/child tree around the focus,
// or along a trace. Positions are shifted so the focus's center is at (0, 0). Both layouts are
// computed here directly, on the main thread: they are deterministic, and far quicker than a
// general layout engine.
//
// The hierarchy is an icicle (LA-BRW-DR330): a horizontal partition chart. A node whose children are
// drawn in the next column is exactly as tall as those children stacked, gaps included, and the
// stack starts at its top edge, so each parent spans its children and every child sits right beside
// it: the parent line is short and straight, and nothing fans out. A leaf, and a node whose children
// are not drawn, keeps the one node height; a "+N more" chip is one child slot. A tree that is not
// the focus's (a record the Links switch brings, with any drawn tree of its own) goes in the nearest
// free place in its columns to the node it was reached from, so it never overlaps.
//
// A trace is a chain, not a tree: each of its columns is a stack of leaf boxes in the model's row
// order, centered on the focus's middle.

export const NODE_WIDTH = 190;
export const NODE_HEIGHT = 56;
/** The space between two columns, and between two boxes stacked in one column. */
export const COLUMN_GAP = 110;
export const ROW_GAP = 28;

export type Point = { x: number; y: number };

export interface Placed {
  /** Top-left corner of each node, keyed by node ID. */
  positions: Map<string, Point>;
  /** Each node's height: NODE_HEIGHT for a leaf, its children's stack for a parent in the icicle. */
  heights: Map<string, number>;
}

/** A node's height in a layout, NODE_HEIGHT when the layout does not say. */
export const heightOf = (heights: ReadonlyMap<string, number> | undefined, id: string) => heights?.get(id) ?? NODE_HEIGHT;

/**
 * The tree of a hierarchy picture as drawn: each node's parent, when the parent is drawn in the
 * column just left of it, and each parent's children in row order (top to bottom).
 */
export function drawnTree(n: Neighborhood): { parentOf: Map<string, string>; childrenOf: Map<string, string[]> } {
  const columnOf = new Map(n.nodes.map((x) => [x.id, x.column]));
  const parentOf = new Map<string, string>();
  for (const e of n.edges) {
    if (e.relation !== PARENT || parentOf.has(e.target)) continue;
    const s = columnOf.get(e.source);
    const t = columnOf.get(e.target);
    if (s !== undefined && t !== undefined && t === s + 1) parentOf.set(e.target, e.source);
  }
  const childrenOf = new Map<string, string[]>();
  for (const x of [...n.nodes].sort((a, b) => a.column - b.column || a.row - b.row)) {
    const p = parentOf.get(x.id);
    if (p !== undefined) childrenOf.set(p, [...(childrenOf.get(p) ?? []), x.id]);
  }
  return { parentOf, childrenOf };
}

/** Whether an edge is a tree connector of the icicle: a parent line to a child in the next column. */
export function isTreeEdge(parentOf: ReadonlyMap<string, string>, e: { source: string; target: string; relation: string }): boolean {
  return e.relation === PARENT && parentOf.get(e.target) === e.source;
}

/**
 * The icicle (LA-BRW-DR330): every node's top-left corner and height, the focus's center at the
 * origin. Pure and deterministic: the same picture always gives the same layout.
 */
export function icicle(n: Neighborhood): { positions: Map<string, Point>; heights: Map<string, number> } {
  const { parentOf, childrenOf } = drawnTree(n);
  const columnOf = new Map(n.nodes.map((x) => [x.id, x.column]));
  const heights = new Map<string, number>();
  const height = (id: string): number => {
    const known = heights.get(id);
    if (known !== undefined) return known;
    const kids = childrenOf.get(id) ?? [];
    const h = kids.length === 0 ? NODE_HEIGHT : kids.reduce((sum, k) => sum + height(k), 0) + ROW_GAP * (kids.length - 1);
    heights.set(id, h);
    return h;
  };
  const xOf = (id: string) => (columnOf.get(id) ?? 0) * (NODE_WIDTH + COLUMN_GAP);
  /** A tree's boxes relative to its root's top: column, top offset and height. */
  const shape = (root: string) => {
    const boxes: { id: string; column: number; top: number; height: number }[] = [];
    const walk = (id: string, top: number) => {
      boxes.push({ id, column: columnOf.get(id) ?? 0, top, height: height(id) });
      let y = top;
      for (const k of childrenOf.get(id) ?? []) { walk(k, y); y += height(k) + ROW_GAP; }
    };
    walk(root, 0);
    return boxes;
  };

  const positions = new Map<string, Point>();
  const taken = new Map<number, { top: number; bottom: number }[]>();
  const fits = (boxes: ReturnType<typeof shape>, y: number) =>
    boxes.every((b) => (taken.get(b.column) ?? []).every((t) => y + b.top + b.height + ROW_GAP <= t.top || y + b.top >= t.bottom + ROW_GAP));
  const put = (boxes: ReturnType<typeof shape>, y: number) => {
    for (const b of boxes) {
      positions.set(b.id, { x: xOf(b.id), y: y + b.top });
      taken.set(b.column, [...(taken.get(b.column) ?? []), { top: y + b.top, bottom: y + b.top + b.height }]);
    }
  };

  // The focus's tree first, then every other tree in the picture's order, as near as it fits to the
  // middle of the node it was reached from.
  let focusRoot = n.focus;
  while (parentOf.has(focusRoot)) focusRoot = parentOf.get(focusRoot)!;
  const roots = [focusRoot, ...[...n.nodes].sort((a, b) => a.column - b.column || a.row - b.row).map((x) => x.id).filter((id) => id !== focusRoot && !parentOf.has(id))];
  for (const root of roots) {
    if (!columnOf.has(root)) continue;
    const boxes = shape(root);
    const from = n.via.get(root);
    const at = from !== undefined ? positions.get(from) : undefined;
    const wanted = at ? at.y + height(from!) / 2 - height(root) / 2 : 0;
    if (fits(boxes, wanted)) { put(boxes, wanted); continue; }
    // The nearest place it fits: just below or just above a box already in one of its columns.
    const candidates = boxes.flatMap((b) => (taken.get(b.column) ?? []).flatMap((t) => [t.bottom + ROW_GAP - b.top, t.top - ROW_GAP - b.top - b.height]));
    const best = candidates.filter((y) => fits(boxes, y)).sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || b - a)[0];
    put(boxes, best ?? wanted);
  }

  const f = positions.get(n.focus) ?? { x: 0, y: 0 };
  const dx = f.x + NODE_WIDTH / 2;
  const dy = f.y + height(n.focus) / 2;
  for (const [id, p] of positions) positions.set(id, { x: Math.round(p.x - dx), y: Math.round(p.y - dy) });
  return { positions, heights };
}

/** A trace's columns (LA-BRW-UC20): each column a stack of leaf boxes in row order, centered on the focus's middle. */
export function traceGrid(n: Neighborhood): { positions: Map<string, Point>; heights: Map<string, number> } {
  const columns = [...new Set(n.nodes.map((x) => x.column))].sort((a, b) => a - b);
  const rank = new Map(columns.map((c, i) => [c, i]));
  const positions = new Map<string, Point>();
  const heights = new Map<string, number>();
  for (const c of columns) {
    const inColumn = n.nodes.filter((x) => x.column === c).sort((a, b) => a.row - b.row);
    const top = -(inColumn.length * NODE_HEIGHT + (inColumn.length - 1) * ROW_GAP) / 2;
    inColumn.forEach((x, i) => {
      positions.set(x.id, { x: rank.get(c)! * (NODE_WIDTH + COLUMN_GAP), y: top + i * (NODE_HEIGHT + ROW_GAP) });
      heights.set(x.id, NODE_HEIGHT);
    });
  }
  const f = positions.get(n.focus) ?? { x: 0, y: 0 };
  const dx = f.x + NODE_WIDTH / 2;
  const dy = f.y + NODE_HEIGHT / 2;
  for (const [id, p] of positions) positions.set(id, { x: Math.round(p.x - dx), y: Math.round(p.y - dy) });
  return { positions, heights };
}

/** Lays out a picture: the icicle for the hierarchy, the columns of a trace. */
export function layoutNeighborhood(n: Neighborhood): Placed {
  if (n.nodes.length === 0) return { positions: new Map(), heights: new Map() };
  return n.mode === 'hierarchy' ? icicle(n) : traceGrid(n);
}

/** The point where the line from a box's center towards (tx, ty) leaves the box. */
export function boxExit(cx: number, cy: number, tx: number, ty: number, w = NODE_WIDTH, h = NODE_HEIGHT) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = 1 / Math.max(Math.abs(dx) / (w / 2), Math.abs(dy) / (h / 2));
  return { x: cx + dx * scale, y: cy + dy * scale };
}

// Character widths, in pixels at a scale of 1, a little over the fonts' averages: the title's body
// font at 12.5 px, and the mono kind-and-ID line at 10.5 px. Estimated, not measured, so a node's
// scale comes from its text alone, once per picture, and never from the DOM (LA-PAT-APP-UX-R11).
const TITLE_CHAR = 7;
const META_CHAR = 6.4;

/** The height a node's content takes at a scale of 1 when its kind-and-ID line breaks in two. */
const META_LINE = 14;

/**
 * How much a node's content grows with its height (LA-BRW-DR331): in proportion to its height over
 * a leaf's, so a tall parent's text, kind, ID, chevron, padding and marks are larger in step, but
 * only as far as the content still fits the column's one width: the title in at most two lines, its
 * longest word on one, and the kind-and-ID line (`meta`, its parts: the kind, then "· ID") on one
 * line, or, where the node is tall enough for the extra line, broken in two between its parts. A
 * leaf's scale is 1, and no node's is below 1. Rounded down to hundredths.
 */
export function contentScale(height: number, title: string, meta: readonly string[] = []): number {
  const byHeight = height / NODE_HEIGHT;
  if (byHeight <= 1) return 1;
  const longest = Math.max(0, ...title.split(/\s+/).map((w) => w.length));
  const byTitle = (1.7 * NODE_WIDTH) / (title.length * TITLE_CHAR + 34);
  const byWord = NODE_WIDTH / (longest * TITLE_CHAR + 20);
  // Padding 10 px each side; the kind line keeps 30 px at its end for the marks.
  const fits = (chars: number) => (chars > 0 ? NODE_WIDTH / (chars * META_CHAR + 50) : Infinity);
  const oneLine = Math.min(byHeight, byTitle, byWord, fits(meta.join(' ').length));
  const twoLines = Math.min(height / (NODE_HEIGHT + META_LINE), byTitle, byWord, fits(Math.max(0, ...meta.map((m) => m.length))));
  const scale = Math.max(1, oneLine, meta.length > 1 ? twoLines : 1);
  return Math.floor(scale * 100) / 100;
}
