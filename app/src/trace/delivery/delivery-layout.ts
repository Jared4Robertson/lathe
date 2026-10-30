import { visible, type DeliveryGraph, type Openness } from './delivery';
import type { DeliveryOrder } from './delivery-order';

// Where each box of the Delivery view goes (LA-V98), pure: rows top to bottom in their order (delivery-order.ts), each
// as tall as its tallest cell, every box one height, a cell's boxes stacked from its row's top, each child indented
// under its parent. Top-down from fixed boxes: a row's place depends only on the rows above it and its own cells, so
// opening a cell moves only its row's boxes and the rows below it, which glide (graph/morph.ts), and nothing beside it
// changes width. A removed row's room stays empty until Tidy up (delivery-order.ts), and an outcome keeps its top once placed. The rows serving no outcome sit after the rest, under the mark "No outcome". Each outcome sits at the
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
/** How many boxes from where its rows would put it a new outcome looks for a free place, before it goes to the bottom of its column. */
export const NEAR_OUTCOME_ROWS = 3;

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

  // The outcomes. Each one laid out before keeps its top (the order's outcomeTops). In a fresh order (none kept) each
  // goes by the median middle of the rows it serves, in its order, a box apart. A new one beside kept ones takes the
  // nearest free place to that median within NEAR_OUTCOME_ROWS boxes, else the bottom of the column. Each top is kept
  // in the order, so opening a row or new data moves no outcome until Tidy up.
  const servedRows = new Map<string, number[]>();
  for (const [o, u] of graph.serves) { const r = rows.get(u); if (r) (servedRows.get(o) ?? servedRows.set(o, []).get(o)!).push(r.y + ITEM_HEIGHT / 2); }
  const shown = order.outcomes.filter((o) => graph.items.has(`outcome/${o}`));
  const fresh = shown.every((o) => !order.outcomeTops.has(o));
  const tops = shown.filter((o) => order.outcomeTops.has(o)).map((o) => order.outcomeTops.get(o)!);
  let at = -PITCH;
  for (const o of shown) {
    const mids = (servedRows.get(o) ?? []).sort((a, b) => a - b);
    const median = mids.length > 0 ? mids[Math.floor((mids.length - 1) / 2)] - ITEM_HEIGHT / 2 : null;
    let y = order.outcomeTops.get(o);
    if (y === undefined && fresh) at = y = Math.max(median ?? at + PITCH, at + PITCH, 0);
    else if (y === undefined) {
      const want = Math.max(0, median ?? Infinity);
      const free = (v: number) => v >= 0 && tops.every((t) => Math.abs(t - v) >= PITCH - 1e-9);
      const near = Number.isFinite(want)
        ? [want, ...tops.flatMap((t) => [t - PITCH, t + PITCH])].filter((v) => Math.abs(v - want) <= NEAR_OUTCOME_ROWS * PITCH + 1e-9 && free(v)).sort((p, q) => Math.abs(p - want) - Math.abs(q - want) || p - q)[0]
        : undefined;
      y = near ?? (tops.length > 0 ? Math.max(...tops) + PITCH : 0);
    }
    tops.push(y);
    order.outcomeTops.set(o, y);
  }
  const outcomes = [...shown].sort((a, b) => order.outcomeTops.get(a)! - order.outcomeTops.get(b)!);
  for (const o of outcomes) {
    places.set(`outcome/${o}`, { x: columnLeft(0), y: order.outcomeTops.get(o)!, w: ITEM_WIDTH, h: ITEM_HEIGHT });
    columns[0].push(`outcome/${o}`);
  }
  const bottom = Math.max(0, ...outcomes.map((o) => order.outcomeTops.get(o)! + ITEM_HEIGHT));
  return { order, rows, columns, places, outsideTop, width: columnLeft(4) + ITEM_WIDTH, height: Math.max(height, bottom) };
}
