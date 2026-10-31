import { useEffect, useState } from 'react';
import { orderColumns, type OrderInput } from './columns';
import type { TraceGraph } from './trace';

// The order of the Trace stage's outcomes and rows (LA-V98), worked out off the page's main thread in its worker
// (order.worker.ts) by the barycenter ordering (columns.ts orderColumns) over two
// columns, the outcomes and the use cases, linked by serves: an outcome sits by the rows it serves and a row by its
// outcomes, so the lines between them stay short. The rows serving an outcome come first, those serving none after
// them. A change moves only what it changed (LA-PAT-APP-UX-R22): given the order shown before, every outcome and row
// kept keeps its order and an outcome its top (layout.ts), a removed row or outcome leaves its room (a closed
// row's, a box's), and a new one takes the nearest such room within a few rows of where its links would put it, else
// goes at the end of its section or column; none is ordered afresh, nor any room closed, unless asked (Tidy up). It is worked out
// again only when what it reads changes (the outcomes, the rows and their serves links: the input's key), never on a
// reload that left them alone; while a new order is made, the one before stays on screen with the graph it was made
// for. Where there is no worker (the unit tests, in jsdom), the same ordering runs on the page.

/**
 * An order: the outcomes top to bottom, the rows, how many removed rows' rooms lie before each row (none for most), and
 * the place in `rows` of the first row serving no outcome (`rows.length` when none does), and each outcome's top.
 */
export interface TraceOrder {
  key: string; outcomes: readonly string[]; rows: readonly string[]; roomBefore: ReadonlyMap<string, number>; firstOutside: number;
  /**
   * Each outcome's top once laid out (layout.ts fills it the first time it places an outcome, and keeps it
   * after): an outcome never moves again until Tidy up. A new order keeps the tops of the outcomes it keeps.
   */
  outcomeTops: Map<string, number>;
}

/** The ordering's input for a graph, numbered (outcomes first, then rows), with its key. */
function inputOf(graph: TraceGraph, previous: TraceOrder | null): { input: OrderInput; keys: string[]; key: string } {
  const keys = [...graph.outcomes, ...graph.rows.map((r) => r.useCase)];
  const number = new Map(keys.map((k, i) => [k, i]));
  const outcomes = graph.outcomes.map((_, i) => i);
  const rows = graph.rows.map((_, i) => graph.outcomes.length + i);
  const columnOf = new Int32Array(keys.length);
  const under = new Uint8Array(keys.length);
  keys.forEach((_, i) => { columnOf[i] = i < graph.outcomes.length ? 0 : 1; under[i] = i < graph.outcomes.length ? 1 : 0; });
  const links = new Int32Array(graph.serves.length * 2);
  graph.serves.forEach(([o, u], i) => { links[2 * i] = number.get(o)!; links[2 * i + 1] = number.get(u)!; under[number.get(u)!] = 1; });
  // The key: FNV-1a over every outcome and row and every serves link.
  let h = 0x811c9dc5;
  const mix = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } };
  keys.forEach((k, i) => mix(`${k}\u0000${columnOf[i]}\u0001`));
  for (const [o, u] of graph.serves) mix(`${o}>${u}\u0002`);
  const key = `${graph.product}|${keys.length}|${graph.serves.length}|${(h >>> 0).toString(36)}`;
  const was = previous ? [previous.outcomes, previous.rows].map((c) => c.filter((k) => number.has(k)).map((k) => number.get(k)!)) : null;
  return { input: { columns: [outcomes, rows], columnOf, under, links, previous: was }, keys, key };
}

/** How many rows from its barycenter a new row looks for a removed row's room, before it goes at the end of its section. */
export const NEAR_ROWS = 3;

/** An order from the ordering's numbers: afresh, or keeping the rows shown before at their slots (`keptRows`). */
function orderOf(key: string, keys: readonly string[], order: number[][], input: OrderInput, previous: TraceOrder | null): TraceOrder {
  const outcomes = order[0].map((b) => keys[b]);
  const merged = order[1].map((b) => keys[b]);
  const number = new Map(keys.map((k, i) => [k, i]));
  const under = (u: string) => input.under[number.get(u)!] === 1;
  if (!previous) return { key, outcomes, rows: merged, roomBefore: new Map(), firstOutside: firstOutsideOf(merged, under), outcomeTops: new Map() };
  const kept = new Set(outcomes);
  return { key, outcomes, ...keptRows(previous, merged, under), outcomeTops: new Map([...previous.outcomeTops].filter(([o]) => kept.has(o))) };
}

const firstOutsideOf = (rows: readonly string[], under: (u: string) => boolean) => { const i = rows.findIndex((u) => !under(u)); return i < 0 ? rows.length : i; };

/**
 * The rows kept at their slots (exported for tests): every row shown before in the same section keeps its slot; a row
 * gone (or moved to the other section) leaves an empty slot, its room; each new row, in the merged order, takes the
 * empty slot of its section nearest the slot the merged order puts it at, within NEAR_ROWS, else a new slot at the end
 * of its section. Empty slots at the very end are dropped.
 */
export function keptRows(previous: TraceOrder, merged: readonly string[], under: (u: string) => boolean): Pick<TraceOrder, 'rows' | 'roomBefore' | 'firstOutside'> {
  const present = new Set(merged);
  // The slots before: each row in turn, its room's empty slots before it; and whether each slot was under an outcome.
  const slots: (string | null)[] = [];
  const slotUnder: boolean[] = [];
  previous.rows.forEach((u, i) => {
    const wasUnder = i < previous.firstOutside;
    for (let k = 0; k < (previous.roomBefore.get(u) ?? 0); k++) { slots.push(null); slotUnder.push(wasUnder); }
    const kept = present.has(u) && under(u) === wasUnder;
    slots.push(kept ? u : null);
    slotUnder.push(wasUnder);
  });
  const placed = new Set(slots.filter((u): u is string => u !== null));
  merged.forEach((u, i) => {
    if (placed.has(u)) return;
    const mine = under(u);
    // Where the merged order puts it: just before the next row it keeps, else at the end of its section.
    const nextKept = merged.slice(i + 1).find((v) => placed.has(v) && under(v) === mine);
    let end = slotUnder.lastIndexOf(mine) + 1;
    if (end === 0) end = mine ? 0 : slots.length;
    const want = nextKept ? slots.indexOf(nextKept) : end;
    let best = -1;
    for (let s = 0; s < slots.length; s++) {
      if (slots[s] !== null || slotUnder[s] !== mine || Math.abs(s - want) > NEAR_ROWS) continue;
      if (best < 0 || Math.abs(s - want) < Math.abs(best - want)) best = s;
    }
    if (best >= 0) slots[best] = u;
    else { slots.splice(end, 0, u); slotUnder.splice(end, 0, mine); }
    placed.add(u);
  });
  while (slots.length > 0 && slots[slots.length - 1] === null) { slots.pop(); slotUnder.pop(); }
  const rows: string[] = [];
  const roomBefore = new Map<string, number>();
  let empty = 0;
  let firstOutside = -1;
  slots.forEach((u, s) => {
    if (u === null) { empty++; return; }
    if (empty > 0) roomBefore.set(u, empty);
    empty = 0;
    if (firstOutside < 0 && !slotUnder[s]) firstOutside = rows.length;
    rows.push(u);
  });
  return { rows, roomBefore, firstOutside: firstOutside < 0 ? rows.length : firstOutside };
}

/** A graph ordered on the page's thread, keeping the order before it (none orders afresh): the worker's rule, for tests. */
export function orderGraph(graph: TraceGraph, previous: TraceOrder | null): TraceOrder {
  const { input, keys, key } = inputOf(graph, previous);
  return orderOf(key, keys, orderColumns(input), input, previous);
}

/** Each product's last order, kept for the page's life: what a new one keeps. */
const lastOf = new Map<string, TraceOrder>();
/** A product's order shown last, if any: the walk's. */
export const shownOrder = (product: string): TraceOrder | null => lastOf.get(product) ?? null;

/** The last order made: where, how long it took and how many outcomes and rows it ordered (the perf suite reads it). */
let last: { thread: 'worker' | 'page'; ms: number; boxes: number; count: number } | null = null;
export const lastTraceOrder = () => last;

let worker: Worker | null | undefined;
let next = 0;
const waiting = new Map<number, (order: number[][] | null) => void>();
function workerOf(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === 'undefined') return (worker = null);
  try {
    worker = new Worker(new URL('./order.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return (worker = null);
  }
  worker.onmessage = (e: MessageEvent<{ id: number; order: number[][]; ms: number }>) => {
    const done = waiting.get(e.data.id);
    waiting.delete(e.data.id);
    last = { thread: 'worker', ms: e.data.ms, boxes: e.data.order.reduce((s, c) => s + c.length, 0), count: (last?.count ?? 0) + 1 };
    done?.(e.data.order);
  };
  worker.onerror = () => {
    // A worker that fails orders nothing again: what it was ordering is ordered here.
    worker?.terminate();
    worker = null;
    for (const done of waiting.values()) done(null);
    waiting.clear();
  };
  return worker;
}

function here(input: OrderInput): number[][] {
  const start = performance.now();
  const order = orderColumns(input);
  last = { thread: 'page', ms: performance.now() - start, boxes: input.columnOf.length, count: (last?.count ?? 0) + 1 };
  return order;
}

/** The order of a graph: at once when it is the one shown (or on the page with no worker), else from the worker. */
function ordered(graph: TraceGraph, tidy: boolean): TraceOrder | Promise<TraceOrder> {
  const shown = lastOf.get(graph.product) ?? null;
  const previous = tidy ? null : shown;
  const { input, keys, key } = inputOf(graph, previous);
  if (previous && previous.key === key) return previous;
  const keep = (order: number[][]) => { const o = orderOf(key, keys, order, input, previous); lastOf.set(graph.product, o); return o; };
  const w = workerOf();
  if (!w) return keep(here(input));
  return new Promise((resolve) => {
    const id = next++;
    waiting.set(id, (order) => resolve(keep(order ?? here(input))));
    w.postMessage({ id, input });
  });
}

/** What the scene draws: an order and the graph it was made for. */
export interface Ordered { order: TraceOrder; graph: TraceGraph }

/**
 * The order for a graph: the graph's own once ordered; until then the one shown before, which stays on screen; null
 * before the first. `tidy` (a count Tidy up raises) orders afresh once, closing every removed row's room.
 */
export function useTraceOrder(graph: TraceGraph, tidy: number): Ordered | null {
  const [shown, setShown] = useState<{ graph: TraceGraph; tidy: number; order: TraceOrder } | null>(null);
  const current = shown?.graph === graph && shown.tidy === tidy ? shown : null;
  useEffect(() => {
    if (current) return;
    let live = true;
    const made = ordered(graph, shown !== null && shown.tidy !== tidy);
    const show = (order: TraceOrder) => { if (live) setShown({ graph, tidy, order }); };
    if (made instanceof Promise) void made.then(show); else show(made);
    return () => { live = false; };
  }, [graph, tidy, current]);
  return shown ? { order: shown.order, graph: shown.graph } : null;
}
