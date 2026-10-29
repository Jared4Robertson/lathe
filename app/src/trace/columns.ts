import type { Viewport } from '../graph/camera';
import type { TraceMap } from './tree';

// The Trace stage's column layout (LA-V98-R13), a second layout beside the tree, as Finder's column view: the same
// product's tree (tree.ts), shown as columns along the focus's path. Column 1 is the product's children; each next column
// is the children of the box chosen in the column before, down to the focus's children (a focus with none ends on its
// own column). Every box is the same size, every column the same width, so the whole path reads at one size; how much a
// box holds is a count on it. A box's column is its depth and its row its place among its siblings, so a box keeps its
// place in its column whatever the focus; a column taller than the stage scrolls on its own. Pure and tested directly;
// TraceColumns.tsx draws it.

/** A column's width and the gap between two columns, a box's height and the gap between two boxes, in CSS pixels at zoom 1. */
export const COLUMN_WIDTH = 272;
export const COLUMN_GAP = 40;
export const BOX_HEIGHT = 84;
export const ROW_GAP = 8;
/** The room kept at a box's right for its count, beside its label. */
export const COUNT_ROOM = 30;
/** The margin round the columns inside the frame. */
export const COLUMNS_PAD = 16;

/** One column: the box whose children it shows, those children, and the one on the focus's path (none in the last). */
export interface TraceColumn { parent: string; keys: readonly string[]; chosen: string | null }

/** The keys from the product down to a key, both included. */
export function pathTo(map: TraceMap, key: string): string[] {
  const path: string[] = [];
  for (let at: string | null = key; at !== null; at = map.map.nodes.get(at)?.parent ?? null) path.unshift(at);
  return path;
}

/** How many boxes a box holds: its children on the tree. */
export const holds = (map: TraceMap, key: string): number => map.map.nodes.get(key)?.children.length ?? 0;

/** The columns for the node the focus stands on (tree.ts focusKey): one per box on its path that holds anything. */
export function traceColumns(map: TraceMap, at: string): TraceColumn[] {
  const path = map.map.nodes.has(at) ? pathTo(map, at) : [map.product];
  const columns: TraceColumn[] = [];
  for (let i = 0; i < path.length; i++) {
    const keys = map.map.nodes.get(path[i])!.children;
    if (keys.length === 0) break;
    columns.push({ parent: path[i], keys, chosen: path[i + 1] ?? null });
  }
  return columns;
}

/** A column's height with `count` boxes, a box's top in its column, and a column's left edge, by its place. */
export const columnHeight = (count: number) => (count === 0 ? 0 : count * BOX_HEIGHT + (count - 1) * ROW_GAP);
export const rowTop = (row: number) => row * (BOX_HEIGHT + ROW_GAP);
export const columnLeft = (column: number) => column * (COLUMN_WIDTH + COLUMN_GAP);

/** How far a column of `count` boxes scrolls at most in a view `view` tall. */
export const maxScroll = (count: number, view: number) => Math.max(0, columnHeight(count) - view);

/** A scroll kept within its column's range. */
export const clampScroll = (scroll: number, count: number, view: number) => Math.min(maxScroll(count, view), Math.max(0, scroll));

/** The least change to a column's scroll that shows one row whole in a view `view` tall, within the column's range. */
export function scrollToShow(count: number, row: number, view: number, scroll: number): number {
  const top = rowTop(row);
  const bottom = top + BOX_HEIGHT;
  let s = scroll;
  if (bottom > s + view) s = bottom - view;
  if (top < s) s = top;
  return clampScroll(s, count, view);
}

/** How many columns fit a width at zoom 1, at least one. */
export const columnsThatFit = (width: number) => Math.max(1, Math.floor((width - 2 * COLUMNS_PAD + COLUMN_GAP) / (COLUMN_WIDTH + COLUMN_GAP)));

/**
 * The camera for a number of columns in a frame: zoom 1, the columns' tops at the frame's top; every column when they all
 * fit, else the last ones that fit (the focus's column, its children and as many parents as fit), the first of them at
 * the frame's left and the earlier ones off to the left.
 */
export function columnsView(count: number, frame: { x: number; y: number; w: number; h: number }): Viewport {
  const first = Math.max(0, count - columnsThatFit(frame.w));
  return { x: frame.x + COLUMNS_PAD - columnLeft(first), y: frame.y + COLUMNS_PAD, zoom: 1 };
}

/** The height a column shows of itself in a frame `height` tall at a zoom. */
export const columnView = (height: number, zoom: number) => Math.max(BOX_HEIGHT, height / zoom - 2 * COLUMNS_PAD);

/** Each column's scroll for a new focus: the one it had (by the box whose children it shows), moved just enough to show its chosen box. */
export function columnScrolls(columns: readonly TraceColumn[], view: number, was: ReadonlyMap<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of columns) {
    const now = clampScroll(was.get(c.parent) ?? 0, c.keys.length, view);
    out.set(c.parent, c.chosen === null ? now : scrollToShow(c.keys.length, c.keys.indexOf(c.chosen), view, now));
  }
  return out;
}

/** One box of the columns, placed in its column scrolled: its key, column, row and box. */
export interface ColumnBox { key: string; column: number; row: number; x: number; y: number; w: number; h: number }

/** The boxes of the columns, each column scrolled by its scroll; with `rows`, only those whose top lies in that range of the view. */
export function columnBoxes(columns: readonly TraceColumn[], scrollOf: (parent: string) => number, rows?: { top: number; bottom: number }): ColumnBox[] {
  const out: ColumnBox[] = [];
  columns.forEach((c, column) => {
    const s = scrollOf(c.parent);
    const x = columnLeft(column);
    const first = rows ? Math.max(0, Math.floor((rows.top + s) / (BOX_HEIGHT + ROW_GAP))) : 0;
    const last = rows ? Math.min(c.keys.length - 1, Math.ceil((rows.bottom + s) / (BOX_HEIGHT + ROW_GAP))) : c.keys.length - 1;
    for (let row = first; row <= last; row++) out.push({ key: c.keys[row], column, row, x, y: rowTop(row) - s, w: COLUMN_WIDTH, h: BOX_HEIGHT });
  });
  return out;
}
