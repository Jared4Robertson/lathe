import { journeyBox, JOURNEY_COLUMN, OUTCOME_COLUMN, STAGE_COLUMN, TRACE_COLUMNS, TRACE_STAGES, visible, type TraceGraph, type Openness } from './trace';
import type { TraceOrder } from './order';

// Where each box of the Trace stage goes (LA-V98), pure: rows top to bottom in their order (order.ts), each
// as tall as its tallest cell, every box one height, a cell's boxes stacked from its row's top, each child indented
// under its parent. Top-down from fixed boxes: a row's place depends only on the rows above it and its own cells, so
// opening a cell moves only its row's boxes and the rows below it, which glide (graph/morph.ts), and nothing beside it
// changes width. A removed row's room stays empty until Tidy up (order.ts), and an outcome keeps its top once placed. The rows serving no outcome sit after the rest, under the mark "No outcome". Each journey sits at the
// median height of the rows it carries out, its boxes stacked down from its top (its steps and test while open), never
// over the journey above it in its order: a journey opened pushes the ones below it down while it is open, and each keeps
// its top once placed. Each outcome sits at the median height of the rows and journeys it serves, never closer than a box
// to the one above it, in its order. The lines from each journey to its rows start at its step's box while the journey is
// open, else at the journey's, labeled with the steps' numbers. Arithmetic only, on the page: every box is one size and no
// text is measured, so it is worked out again at once when a cell opens.

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

/** A line from a journey to a use case row it carries out: from the step's box while it shows, else the journey's, with every step's number it stands for. */
export interface CarryLine { from: string; to: string; journey: string; useCase: string; label: string }

/** A laid-out Trace stage. */
export interface TraceLaid {
  /** The order it was laid out in. */
  order: TraceOrder;
  /** Each row's band: its top and height, in order. */
  rows: ReadonlyMap<string, { y: number; h: number }>;
  /** Each column's boxes top to bottom, as shown. */
  columns: readonly (readonly string[])[];
  places: ReadonlyMap<string, BoxPlace>;
  /** The journeys' lines to their rows. */
  carries: readonly CarryLine[];
  /** The top of the rows serving no outcome (null when there are none). */
  outsideTop: number | null;
  width: number;
  height: number;
}

/** The view's places for an order and what is open. */
export function layOutTrace(graph: TraceGraph, order: TraceOrder, open: Openness): TraceLaid {
  const places = new Map<string, BoxPlace>();
  const rows = new Map<string, { y: number; h: number }>();
  const columns: string[][] = TRACE_COLUMNS.map(() => []);
  let y = 0;
  let outsideTop: number | null = null;
  for (const u of order.rows) {
    const row = graph.rowOf.get(u);
    if (!row) continue;
    // A removed row's room, kept until Tidy up (order.ts): a closed row's height each.
    y += (order.roomBefore.get(u) ?? 0) * (ITEM_HEIGHT + ROW_GAP);
    if (outsideTop === null && row.data.outcomes.every((o) => !graph.items.has(`outcome/${o}`))) {
      y += y > 0 ? OUTSIDE_GAP : OUTSIDE_GAP - ROW_GAP;
      outsideTop = y;
    }
    let tallest = 1;
    for (const stage of TRACE_STAGES) {
      const c = STAGE_COLUMN[stage];
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

  // The journeys, in their order: each at the median middle of the rows it carries out (kept once placed, as an
  // outcome's top), never over the one above it.
  const carriedRows = new Map<string, number[]>();
  for (const c of graph.carries) { const r = rows.get(c.useCase); if (r) (carriedRows.get(c.journey) ?? carriedRows.set(c.journey, []).get(c.journey)!).push(r.y + ITEM_HEIGHT / 2); }
  let floor = 0;
  for (const j of order.journeys) {
    const key = journeyBox(j);
    if (!graph.items.has(key)) continue;
    let top = order.journeyTops.get(j);
    if (top === undefined) {
      const mids = (carriedRows.get(j) ?? []).sort((a, b) => a - b);
      const median = mids.length > 0 ? mids[Math.floor((mids.length - 1) / 2)] - ITEM_HEIGHT / 2 : floor;
      top = Math.max(median, floor);
      order.journeyTops.set(j, top);
    }
    const at = Math.max(top, floor);
    const shown = visible(graph, key, open);
    shown.forEach((k, i) => {
      const inset = graph.items.get(k)!.depth * INDENT;
      places.set(k, { x: columnLeft(JOURNEY_COLUMN) + inset, y: at + i * PITCH, w: ITEM_WIDTH - inset, h: ITEM_HEIGHT });
      columns[JOURNEY_COLUMN].push(k);
    });
    floor = at + shown.length * PITCH;
  }
  // Each journey's lines to its rows: one per box and row, labeled with every step's number it stands for.
  const lines = new Map<string, CarryLine>();
  for (const c of graph.carries) {
    const to = `${c.useCase}|use-case`;
    if (!places.has(to)) continue;
    const from = graph.boxesOf.get(c.step)?.find((k) => places.has(k)) ?? journeyBox(c.journey);
    const line = lines.get(`${from}>${to}`);
    if (line) line.label = `${line.label}, ${c.label}`;
    else lines.set(`${from}>${to}`, { from, to, journey: c.journey, useCase: c.useCase, label: c.label });
  }

  // The outcomes. Each one laid out before keeps its top (the order's outcomeTops). In a fresh order (none kept) each
  // goes by the median middle of the rows it serves, in its order, a box apart. A new one beside kept ones takes the
  // nearest free place to that median within NEAR_OUTCOME_ROWS boxes, else the bottom of the column. Each top is kept
  // in the order, so opening a row or new data moves no outcome until Tidy up.
  const servedRows = new Map<string, number[]>();
  const served = (o: string, y: number) => (servedRows.get(o) ?? servedRows.set(o, []).get(o)!).push(y + ITEM_HEIGHT / 2);
  for (const [o, u] of graph.serves) { const r = rows.get(u); if (r) served(o, r.y); }
  for (const [o, j] of graph.journeyServes) { const p = places.get(journeyBox(j)); if (p) served(o, p.y); }
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
    places.set(`outcome/${o}`, { x: columnLeft(OUTCOME_COLUMN), y: order.outcomeTops.get(o)!, w: ITEM_WIDTH, h: ITEM_HEIGHT });
    columns[OUTCOME_COLUMN].push(`outcome/${o}`);
  }
  const bottom = Math.max(0, floor - ITEM_GAP, ...outcomes.map((o) => order.outcomeTops.get(o)! + ITEM_HEIGHT));
  return { order, rows, columns, places, carries: [...lines.values()], outsideTop, width: columnLeft(TRACE_COLUMNS.length - 1) + ITEM_WIDTH, height: Math.max(height, bottom) };
}

/**
 * The places with what belongs beside a row slid to its height (LA-V98-R22), pure: in the Outcome column the outcomes
 * its use case serves, in the Journey column the journeys carrying it out (a journey open to its steps by the step box
 * carrying it out, the journey's other boxes kept with it as one block). Each column on its own (besideIn): what is
 * beside the row is stacked in the column's order and centered on the row's first line (its use case), never above the
 * top; every other block keeps its place unless the stack covers it, when it steps aside just enough, up or down,
 * whichever is nearer, pushing on the ones beyond it. No other box moves; the lines follow their boxes. With no row,
 * or one with nothing beside it shown, the laid view itself: each box at its own place.
 */
export function besideRow(laid: TraceLaid, serves: readonly (readonly [string, string])[], row: string | null): TraceLaid {
  const band = row ? laid.rows.get(row) : undefined;
  if (!band) return laid;
  const outcomes = new Set(serves.filter(([, u]) => u === row).map(([o]) => `outcome/${o}`));
  const journeys = new Set(laid.carries.filter((c) => c.useCase === row).map((c) => c.from));
  const tops = new Map<string, number>([
    ...besideIn(laid, laid.columns[OUTCOME_COLUMN].map((k) => [k]), outcomes, band.y),
    // A journey's block: its box and every box under it that shows, top to bottom.
    ...besideIn(laid, blocksOf(laid.columns[JOURNEY_COLUMN]), journeys, band.y),
  ]);
  if (tops.size === 0) return laid;
  const places = new Map(laid.places);
  for (const [k, y] of tops) places.set(k, { ...laid.places.get(k)!, y });
  const sorted = (keys: readonly string[]) => [...keys].sort((a, b) => places.get(a)!.y - places.get(b)!.y);
  const columns = laid.columns.map((keys, c) => (c === OUTCOME_COLUMN || c === JOURNEY_COLUMN ? sorted(keys) : keys));
  const bottom = Math.max(...[...tops.values()].map((y) => y + ITEM_HEIGHT));
  return { ...laid, columns, places, height: Math.max(laid.height, bottom) };
}

/** A Journey column's boxes as blocks, one per journey: its box, then its boxes under it. */
function blocksOf(keys: readonly string[]): string[][] {
  const blocks: string[][] = [];
  for (const k of keys) {
    const journey = k.split('/').slice(0, 2).join('/');
    const last = blocks.at(-1);
    if (last && last[0] === journey) last.push(k); else blocks.push([k]);
  }
  return blocks;
}

/**
 * One column's new tops with the blocks holding a key of `beside` slid to a row whose top is `row`: each such block
 * by its first key there (its anchor), stacked a box apart in the column's order, the first and last anchors centered
 * on the row's first line, never above the top; the other blocks step aside just enough (those whose middle is above
 * the stack's up, the rest down), each kept whole. Empty when no block is beside the row.
 */
function besideIn(laid: TraceLaid, blocks: readonly (readonly string[])[], beside: ReadonlySet<string>, row: number): Map<string, number> {
  const tops = new Map<string, number>();
  const stack = blocks.filter((b) => b.some((k) => beside.has(k)));
  if (stack.length === 0) return tops;
  const home = (b: readonly string[]) => laid.places.get(b[0])!.y;
  const tall = (b: readonly string[]) => b.length * PITCH;
  const anchor = (b: readonly string[]) => b.findIndex((k) => beside.has(k)) * PITCH;
  // The stack's anchors, from its top: the first block's and the last's, whose middle sits on the row's.
  const heights = stack.map(tall);
  const lastStart = heights.slice(0, -1).reduce((s, h) => s + h, 0);
  const top = Math.max(0, row - (anchor(stack[0]) + lastStart + anchor(stack.at(-1)!)) / 2);
  const end = top + heights.reduce((s, h) => s + h, 0);
  let at = top;
  for (const b of stack) { b.forEach((k, i) => tops.set(k, at + i * PITCH)); at += tall(b); }
  // The others: those whose middle is above the stack's step up, the rest down, each just clear of the one before.
  const others = blocks.filter((b) => !stack.includes(b));
  const middle = (top + end - ITEM_GAP) / 2;
  const mid = (b: readonly string[]) => home(b) + (tall(b) - ITEM_GAP) / 2;
  const up = others.filter((b) => mid(b) < middle).reverse();
  const down = others.filter((b) => mid(b) >= middle);
  // Up never goes above the top: what has no room there steps down instead, the farthest up first.
  const packUp = () => { let ceiling = top; return up.map((b) => (ceiling = Math.min(home(b), ceiling - tall(b)))); };
  while (up.length > 0 && Math.min(...packUp()) < 0) down.unshift(up.pop()!);
  packUp().forEach((y, i) => up[i].forEach((k, j) => tops.set(k, y + j * PITCH)));
  down.sort((a, b) => home(a) - home(b));
  let floor = end;
  for (const b of down) { const y = Math.max(home(b), floor); b.forEach((k, j) => tops.set(k, y + j * PITCH)); floor = y + tall(b); }
  return tops;
}
