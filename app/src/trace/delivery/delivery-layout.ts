import { visible, type DeliveryGraph, type Openness } from './delivery';
import type { DeliveryOrder } from './delivery-order';

// Where each box of the Delivery view goes (LA-V98), pure: rows top to bottom in their order (delivery-order.ts), each
// as tall as its tallest cell, every box one height, a cell's boxes stacked from its row's top, each child indented
// under its parent. Top-down from fixed boxes: a row's place depends only on the rows above it and its own cells, so
// opening a cell moves only its row's boxes and the rows below it, which glide (graph/morph.ts), and nothing beside it
// changes width. A removed row's room stays empty until Tidy up (delivery-order.ts). The rows serving no outcome sit after the rest, under the mark "No outcome". Each outcome sits at the
// median height of the rows it serves, never closer than a box to the one above it, in its order. Arithmetic only, on
// the page: every box is one size and no text is measured, so it is worked out again at once when a cell opens.

/** A box's width and height, the indent of a child, the gap between two boxes of a cell and between two rows, and the room between columns, where the lines run. */
export const ITEM_WIDTH = 264;
export const ITEM_HEIGHT = 72;
export const INDENT = 18;
export const ITEM_GAP = 6;
export const ROW_GAP = 22;
export const COLUMN_GAP = 88;
/** The gap above the rows serving no outcome, which holds their mark. */
export const OUTSIDE_GAP = 72;
const PITCH = ITEM_HEIGHT + ITEM_GAP;

/** A column's left edge. */
export const columnLeft = (column: number) => column * (ITEM_WIDTH + COLUMN_GAP);

/** One box's place, in map units. */
export interface BoxPlace { x: number; y: number; w: number; h: number }

/** A laid-out Delivery view. */
export interface DeliveryLaid {
  /** The order it was laid out in. */
  order: DeliveryOrder;
  /** Each row's band: its top and height, in order. */
  rows: ReadonlyMap<string, { y: number; h: number }>;
  /** Each column's boxes top to bottom, as shown. */
  columns: readonly (readonly string[])[];
  places: ReadonlyMap<string, BoxPlace>;
  /** The top of the rows serving no outcome (null when there are none). */
  outsideTop: number | null;
  width: number;
  height: number;
}

/** The view's places for an order and what is open. */
export function layOutDelivery(graph: DeliveryGraph, order: DeliveryOrder, open: Openness): DeliveryLaid {
  const places = new Map<string, BoxPlace>();
  const rows = new Map<string, { y: number; h: number }>();
  const columns: string[][] = [[], [], [], [], []];
  let y = 0;
  let outsideTop: number | null = null;
  for (const u of order.rows) {
    const row = graph.rowOf.get(u);
    if (!row) continue;
    // A removed row's room, kept until Tidy up (delivery-order.ts): a closed row's height each.
    y += (order.roomBefore.get(u) ?? 0) * (ITEM_HEIGHT + ROW_GAP);
    if (outsideTop === null && row.data.outcomes.every((o) => !graph.items.has(`outcome/${o}`))) {
      y += y > 0 ? OUTSIDE_GAP : OUTSIDE_GAP - ROW_GAP;
      outsideTop = y;
    }
    let tallest = 1;
    for (let c = 1; c <= 4; c++) {
      const shown = visible(graph, row.cells[c], open);
      tallest = Math.max(tallest, shown.length);
      shown.forEach((key, i) => {
        const item = graph.items.get(key)!;
        const inset = item.depth * INDENT;
        places.set(key, { x: columnLeft(c) + inset, y: y + i * PITCH, w: ITEM_WIDTH - inset, h: ITEM_HEIGHT });
        columns[c].push(key);
      });
    }
    const h = tallest * PITCH - ITEM_GAP;
    rows.set(u, { y, h });
    y += h + ROW_GAP;
  }
  const height = Math.max(0, y - ROW_GAP);

  // The outcomes, each by the median middle of the rows it serves, in their order, a box apart.
  const servedRows = new Map<string, number[]>();
  for (const [o, u] of graph.serves) { const r = rows.get(u); if (r) (servedRows.get(o) ?? servedRows.set(o, []).get(o)!).push(r.y + ITEM_HEIGHT / 2); }
  let at = -PITCH;
  for (const o of order.outcomes) {
    const key = `outcome/${o}`;
    if (!graph.items.has(key)) continue;
    const mids = (servedRows.get(o) ?? []).sort((a, b) => a - b);
    const want = mids.length > 0 ? mids[Math.floor((mids.length - 1) / 2)] - ITEM_HEIGHT / 2 : at + PITCH;
    at = Math.max(want, at + PITCH, 0);
    places.set(key, { x: columnLeft(0), y: at, w: ITEM_WIDTH, h: ITEM_HEIGHT });
    columns[0].push(key);
  }
  return { order, rows, columns, places, outsideTop, width: columnLeft(4) + ITEM_WIDTH, height: Math.max(height, at + ITEM_HEIGHT) };
}
