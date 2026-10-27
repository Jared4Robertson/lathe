import type { Neighborhood } from './model';

// Box sizes and the trace's layout. The hierarchy is one map of a product's tree (map.ts); a trace is
// a chain, not a tree, so it keeps a picture of its own: each of its columns a stack of leaf boxes
// in the model's row order, centered on the focus's middle (LA-V93-R15).

/** A trace's box: every box in a trace, at text scale 1. */
export const NODE_WIDTH = 190;
export const NODE_HEIGHT = 56;
/** The space between two columns of a trace, and between two boxes stacked in one. */
export const TRACE_COLUMN_GAP = 110;
export const TRACE_ROW_GAP = 28;

export type Point = { x: number; y: number };

export interface Placed {
  /** Top-left corner of each node, keyed by node ID. */
  positions: Map<string, Point>;
  heights: Map<string, number>;
  widths: Map<string, number>;
}

/** A node's height in a layout, NODE_HEIGHT when the layout does not say. */
export const heightOf = (heights: ReadonlyMap<string, number> | undefined, id: string) => heights?.get(id) ?? NODE_HEIGHT;
/** A node's width in a layout, NODE_WIDTH when the layout does not say. */
export const widthOf = (widths: ReadonlyMap<string, number> | undefined, id: string) => widths?.get(id) ?? NODE_WIDTH;

/**
 * A trace's columns (LA-EXP-UC03): each column a stack of leaf boxes in row order, centered on the
 * focus's middle. A box is a leaf's size, or taller when `heightOf` says its label needs it.
 */
export function traceGrid(n: Neighborhood, heightOf: (id: string) => number = () => NODE_HEIGHT): Placed {
  const columns = [...new Set(n.nodes.map((x) => x.column))].sort((a, b) => a - b);
  const rank = new Map(columns.map((c, i) => [c, i]));
  const positions = new Map<string, Point>();
  const heights = new Map<string, number>();
  const widths = new Map<string, number>();
  for (const c of columns) {
    const inColumn = n.nodes.filter((x) => x.column === c).sort((a, b) => a.row - b.row);
    const own = inColumn.map((x) => Math.max(NODE_HEIGHT, heightOf(x.id)));
    let y = -(own.reduce((sum, h) => sum + h, 0) + (inColumn.length - 1) * TRACE_ROW_GAP) / 2;
    inColumn.forEach((x, i) => {
      positions.set(x.id, { x: rank.get(c)! * (NODE_WIDTH + TRACE_COLUMN_GAP), y });
      heights.set(x.id, own[i]);
      widths.set(x.id, NODE_WIDTH);
      y += own[i] + TRACE_ROW_GAP;
    });
  }
  const f = positions.get(n.focus) ?? { x: 0, y: 0 };
  const dx = f.x + NODE_WIDTH / 2;
  const dy = f.y + (heights.get(n.focus) ?? NODE_HEIGHT) / 2;
  for (const [id, p] of positions) positions.set(id, { x: Math.round(p.x - dx), y: Math.round(p.y - dy) });
  return { positions, heights, widths };
}

/** The point where the line from a box's center towards (tx, ty) leaves the box. */
export function boxExit(cx: number, cy: number, tx: number, ty: number, w = NODE_WIDTH, h = NODE_HEIGHT) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = 1 / Math.max(Math.abs(dx) / (w / 2), Math.abs(dy) / (h / 2));
  return { x: cx + dx * scale, y: cy + dy * scale };
}
