import type { Viewport } from '../graph/camera';
import type { TraceMap } from './tree';

// The Trace stage's column layout (LA-V98-R13), a second layout beside the tree, as Finder's column view: the same
// product's tree (tree.ts), shown as columns along the focus's path. Column 1 is the product's children; each next column
// is the children of the box chosen in the column before, down to the focus's children (a focus with none ends on its
// own column). The focus's column, its parent's and its children's are full width, every box in them the same size, how
// much a box holds a count on it; the columns further up the path are compact, each box its title alone, so the whole
// path from the product fits beside them. A box's column is its depth and its row its place among its siblings; a column taller than
// the stage scrolls on its own. Pure and tested directly;
// TraceColumns.tsx draws it.

/** A column's width and the gap between two columns, a box's height and the gap between two boxes, in CSS pixels at zoom 1. */
export const COLUMN_WIDTH = 272;
export const COLUMN_GAP = 24;
export const BOX_HEIGHT = 84;
export const ROW_GAP = 8;
/** A compact column's width and its boxes' height: a title of two lines at the full columns' title size. */
export const COMPACT_WIDTH = 152;
export const COMPACT_HEIGHT = 56;
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

/** A column's size: its width, its boxes' height, and whether it is compact (its boxes their titles alone). */
export interface ColumnSize { w: number; h: number; compact: boolean }
const FULL: ColumnSize = { w: COLUMN_WIDTH, h: BOX_HEIGHT, compact: false };
const COMPACT: ColumnSize = { w: COMPACT_WIDTH, h: COMPACT_HEIGHT, compact: true };

/** The column the focus's node sits in, or -1 for the product. */
export const focusColumn = (columns: readonly TraceColumn[], at: string) => columns.findIndex((c) => c.keys.includes(at));

/** Each column's size: compact left of the focus's parent's column, full from it on. */
export function columnSizes(columns: readonly TraceColumn[], at: string): ColumnSize[] {
  const f = focusColumn(columns, at);
  return columns.map((_, i) => (f >= 0 && i < f - 1 ? COMPACT : FULL));
}

/** Each column's left edge, the next a gap after the one before. */
export function columnLefts(sizes: readonly ColumnSize[]): number[] {
  const out: number[] = [];
  let x = 0;
  for (const s of sizes) { out.push(x); x += s.w + COLUMN_GAP; }
  return out;
}

/** A column's height with `count` boxes `h` tall, and a box's top in its column. */
export const columnHeight = (count: number, h = BOX_HEIGHT) => (count === 0 ? 0 : count * h + (count - 1) * ROW_GAP);
export const rowTop = (row: number, h = BOX_HEIGHT) => row * (h + ROW_GAP);

/** How far a column of `count` boxes `h` tall scrolls at most in a view `view` tall. */
export const maxScroll = (count: number, view: number, h = BOX_HEIGHT) => Math.max(0, columnHeight(count, h) - view);

/** A scroll kept within its column's range. */
export const clampScroll = (scroll: number, count: number, view: number, h = BOX_HEIGHT) => Math.min(maxScroll(count, view, h), Math.max(0, scroll));

/** The least change to a column's scroll that shows one row whole in a view `view` tall, within the column's range. */
export function scrollToShow(count: number, row: number, view: number, scroll: number, h = BOX_HEIGHT): number {
  const top = rowTop(row, h);
  const bottom = top + h;
  let s = scroll;
  if (bottom > s + view) s = bottom - view;
  if (top < s) s = top;
  return clampScroll(s, count, view, h);
}

/**
 * The camera for some columns in a frame: zoom 1, the columns' tops at the frame's top; every column from the frame's
 * left when they all fit, else the last column ending at the frame's right, the earlier ones off to the left.
 */
export function columnsView(sizes: readonly ColumnSize[], frame: { x: number; y: number; w: number; h: number }): Viewport {
  const lefts = columnLefts(sizes);
  const width = sizes.length === 0 ? 0 : lefts[sizes.length - 1] + sizes[sizes.length - 1].w;
  const x = width <= frame.w - 2 * COLUMNS_PAD ? frame.x + COLUMNS_PAD : frame.x + frame.w - COLUMNS_PAD - width;
  return { x, y: frame.y + COLUMNS_PAD, zoom: 1 };
}

/** The height a column shows of itself in a frame `height` tall at a zoom. */
export const columnView = (height: number, zoom: number) => Math.max(BOX_HEIGHT, height / zoom - 2 * COLUMNS_PAD);

/** Each column's scroll for a new focus: the one it had (by the box whose children it shows), moved just enough to show its chosen box. */
export function columnScrolls(columns: readonly TraceColumn[], sizes: readonly ColumnSize[], view: number, was: ReadonlyMap<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  columns.forEach((c, i) => {
    const h = sizes[i].h;
    const now = clampScroll(was.get(c.parent) ?? 0, c.keys.length, view, h);
    out.set(c.parent, c.chosen === null ? now : scrollToShow(c.keys.length, c.keys.indexOf(c.chosen), view, now, h));
  });
  return out;
}

/** One box of the columns, placed in its column scrolled: its key, column, row and box. */
export interface ColumnBox { key: string; column: number; row: number; x: number; y: number; w: number; h: number }

/** The boxes of the columns, each column scrolled by its scroll; with `rows`, only those whose top lies in that range of the view. */
export function columnBoxes(columns: readonly TraceColumn[], sizes: readonly ColumnSize[], scrollOf: (parent: string) => number, rows?: { top: number; bottom: number }): ColumnBox[] {
  const out: ColumnBox[] = [];
  const lefts = columnLefts(sizes);
  columns.forEach((c, column) => {
    const { w, h } = sizes[column];
    const s = scrollOf(c.parent);
    const first = rows ? Math.max(0, Math.floor((rows.top + s) / (h + ROW_GAP))) : 0;
    const last = rows ? Math.min(c.keys.length - 1, Math.ceil((rows.bottom + s) / (h + ROW_GAP))) : c.keys.length - 1;
    for (let row = first; row <= last; row++) out.push({ key: c.keys[row], column, row, x: lefts[column], y: rowTop(row, h) - s, w, h });
  });
  return out;
}
