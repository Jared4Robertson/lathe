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
// free place in its columns to the node it was reached from, so it never overlaps. Each column is as
// wide as its tallest node's scale makes it (LA-BRW-DR331), at most MAX_COLUMN_SCALE leaf widths, so
// every node in a level shares one width; columns sit a gap apart at their own widths.
//
// A trace is a chain, not a tree: each of its columns is a stack of leaf boxes in the model's row
// order, centered on the focus's middle.

export const NODE_WIDTH = 190;
export const NODE_HEIGHT = 56;
/** The space between two columns, and between two boxes stacked in one column. */
export const COLUMN_GAP = 110;
export const ROW_GAP = 28;

export type Point = { x: number; y: number };

/**
 * The most a column widens (LA-BRW-DR331): four leaf widths, 760 px. A domain at depth 2 or 3 is
 * dozens of leaf heights tall, so the framed picture is zoomed to a fifth or less and is far taller
 * than wide. At four widths a parent's text reads at about a leaf's size when that picture is framed,
 * and the depth-3 picture stays about as wide as it is tall, so the zoom is still set by its height,
 * not its width; a column in full proportion would be thousands of pixels wide and shrink it all.
 */
export const MAX_COLUMN_SCALE = 4;

export interface Placed {
  /** Top-left corner of each node, keyed by node ID. */
  positions: Map<string, Point>;
  /** Each node's height: NODE_HEIGHT for a leaf, its children's stack for a parent in the icicle. */
  heights: Map<string, number>;
  /** Each node's width: its column's, NODE_WIDTH for a column of leaves, wider for a column of tall parents. */
  widths: Map<string, number>;
}

/** A node's height in a layout, NODE_HEIGHT when the layout does not say. */
export const heightOf = (heights: ReadonlyMap<string, number> | undefined, id: string) => heights?.get(id) ?? NODE_HEIGHT;
/** A node's width in a layout, NODE_WIDTH when the layout does not say. */
export const widthOf = (widths: ReadonlyMap<string, number> | undefined, id: string) => widths?.get(id) ?? NODE_WIDTH;

/**
 * Each column's width (LA-BRW-DR331): a leaf's width times the largest scale in the column (its
 * tallest node's height over a leaf's), at most MAX_COLUMN_SCALE; a column of leaves keeps a leaf's.
 */
export function columnWidths(columns: ReadonlyMap<string, number>, heights: ReadonlyMap<string, number>): Map<number, number> {
  const widths = new Map<number, number>();
  for (const [id, c] of columns) {
    const scale = Math.min(MAX_COLUMN_SCALE, Math.max(1, heightOf(heights, id) / NODE_HEIGHT));
    // Even, so a box's middle is a whole pixel.
    widths.set(c, Math.max(widths.get(c) ?? NODE_WIDTH, 2 * Math.round((NODE_WIDTH * scale) / 2)));
  }
  return widths;
}

/** Each column's left edge: the columns before it, each at its own width, a gap apart. */
function columnLefts(widths: ReadonlyMap<number, number>): Map<number, number> {
  const lefts = new Map<number, number>();
  let x = 0;
  for (const c of [...widths.keys()].sort((a, b) => a - b)) {
    lefts.set(c, x);
    x += widths.get(c)! + COLUMN_GAP;
  }
  return lefts;
}

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
export function icicle(n: Neighborhood): Placed {
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
  for (const x of n.nodes) height(x.id);
  const columnWidth = columnWidths(columnOf, heights);
  const lefts = columnLefts(columnWidth);
  const xOf = (id: string) => lefts.get(columnOf.get(id) ?? 0) ?? 0;
  const widths = new Map(n.nodes.map((x) => [x.id, columnWidth.get(x.column) ?? NODE_WIDTH]));
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
  const dx = f.x + widthOf(widths, n.focus) / 2;
  const dy = f.y + height(n.focus) / 2;
  for (const [id, p] of positions) positions.set(id, { x: Math.round(p.x - dx), y: Math.round(p.y - dy) });
  return { positions, heights, widths };
}

/** A trace's columns (LA-BRW-UC20): each column a stack of leaf boxes in row order, centered on the focus's middle. */
export function traceGrid(n: Neighborhood): Placed {
  const columns = [...new Set(n.nodes.map((x) => x.column))].sort((a, b) => a - b);
  const rank = new Map(columns.map((c, i) => [c, i]));
  const positions = new Map<string, Point>();
  const heights = new Map<string, number>();
  const widths = new Map<string, number>();
  for (const c of columns) {
    const inColumn = n.nodes.filter((x) => x.column === c).sort((a, b) => a.row - b.row);
    const top = -(inColumn.length * NODE_HEIGHT + (inColumn.length - 1) * ROW_GAP) / 2;
    inColumn.forEach((x, i) => {
      positions.set(x.id, { x: rank.get(c)! * (NODE_WIDTH + COLUMN_GAP), y: top + i * (NODE_HEIGHT + ROW_GAP) });
      heights.set(x.id, NODE_HEIGHT);
      widths.set(x.id, NODE_WIDTH);
    });
  }
  const f = positions.get(n.focus) ?? { x: 0, y: 0 };
  const dx = f.x + NODE_WIDTH / 2;
  const dy = f.y + NODE_HEIGHT / 2;
  for (const [id, p] of positions) positions.set(id, { x: Math.round(p.x - dx), y: Math.round(p.y - dy) });
  return { positions, heights, widths };
}

/** Lays out a picture: the icicle for the hierarchy, the columns of a trace. */
export function layoutNeighborhood(n: Neighborhood): Placed {
  if (n.nodes.length === 0) return { positions: new Map(), heights: new Map(), widths: new Map() };
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

/**
 * How much a node's content grows (LA-BRW-DR331): by the smaller of its width over a leaf's and its
 * height over a leaf's, so its text, kind, ID, chevron, padding and marks keep their proportions and
 * fit the box whichever way it is short. A leaf's scale is 1, and no node's is below 1. Rounded
 * down to hundredths. From the layout alone, once per picture, never by measuring text.
 */
export function contentScale(width: number, height: number): number {
  const scale = Math.max(1, Math.min(width / NODE_WIDTH, height / NODE_HEIGHT));
  return Math.floor(scale * 100) / 100;
}
