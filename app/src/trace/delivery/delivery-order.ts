import { useEffect, useState } from 'react';
import { orderColumns, type LayoutInput } from '../all-layout';
import type { DeliveryGraph } from './delivery';

// The order of the Delivery view's outcomes and rows (LA-V98), worked out off the page's main thread in its worker
// (delivery-order.worker.ts) by the All-at-once view's barycenter ordering (all-layout.ts orderColumns) over two
// columns, the outcomes and the use cases, linked by serves: an outcome sits by the rows it serves and a row by its
// outcomes, so the lines between them stay short. The rows serving an outcome come first, those serving none after
// them. Layout stability (LA-PAT-APP-UX-R22): given the order shown before, every outcome and row kept keeps its order,
// a new one goes in at its barycenter among them, and none is ordered afresh unless asked (Tidy up). It is worked out
// again only when what it reads changes (the outcomes, the rows and their serves links: the input's key), never on a
// reload that left them alone; while a new order is made, the one before stays on screen with the graph it was made
// for. Where there is no worker (the unit tests, in jsdom), the same ordering runs on the page.

/** An order: the outcomes top to bottom, and the rows. */
export interface DeliveryOrder { key: string; outcomes: readonly string[]; rows: readonly string[] }

/** The ordering's input for a graph, numbered (outcomes first, then rows), with its key. */
function inputOf(graph: DeliveryGraph, previous: DeliveryOrder | null): { input: LayoutInput; keys: string[]; key: string } {
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

const orderOf = (key: string, keys: readonly string[], order: number[][]): DeliveryOrder => ({ key, outcomes: order[0].map((b) => keys[b]), rows: order[1].map((b) => keys[b]) });

/** A graph ordered on the page's thread, keeping the order before it (none orders afresh): the worker's rule, for tests. */
export function orderGraph(graph: DeliveryGraph, previous: DeliveryOrder | null): DeliveryOrder {
  const { input, keys, key } = inputOf(graph, previous);
  return orderOf(key, keys, orderColumns(input));
}

/** Each product's last order, kept for the page's life: what a new one keeps. */
const lastOf = new Map<string, DeliveryOrder>();
/** A product's order shown last, if any: the walk's. */
export const shownOrder = (product: string): DeliveryOrder | null => lastOf.get(product) ?? null;

/** The last order made: where, how long it took and how many outcomes and rows it ordered (the perf suite reads it). */
let last: { thread: 'worker' | 'page'; ms: number; boxes: number; count: number } | null = null;
export const lastDeliveryOrder = () => last;

let worker: Worker | null | undefined;
let next = 0;
const waiting = new Map<number, (order: number[][] | null) => void>();
function workerOf(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === 'undefined') return (worker = null);
  try {
    worker = new Worker(new URL('./delivery-order.worker.ts', import.meta.url), { type: 'module' });
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

function here(input: LayoutInput): number[][] {
  const start = performance.now();
  const order = orderColumns(input);
  last = { thread: 'page', ms: performance.now() - start, boxes: input.columnOf.length, count: (last?.count ?? 0) + 1 };
  return order;
}

/** The order of a graph: at once when it is the one shown (or on the page with no worker), else from the worker. */
function ordered(graph: DeliveryGraph, tidy: boolean): DeliveryOrder | Promise<DeliveryOrder> {
  const shown = lastOf.get(graph.product) ?? null;
  const previous = tidy ? null : shown;
  const { input, keys, key } = inputOf(graph, previous);
  if (previous && previous.key === key) return previous;
  const keep = (order: number[][]) => { const o = orderOf(key, keys, order); lastOf.set(graph.product, o); return o; };
  const w = workerOf();
  if (!w) return keep(here(input));
  return new Promise((resolve) => {
    const id = next++;
    waiting.set(id, (order) => resolve(keep(order ?? here(input))));
    w.postMessage({ id, input });
  });
}

/** What the scene draws: an order and the graph it was made for. */
export interface Ordered { order: DeliveryOrder; graph: DeliveryGraph }

/**
 * The order for a graph: the graph's own once ordered; until then the one shown before, which stays on screen; null
 * before the first. `tidy` (a count the Tidy up button raises) orders afresh once.
 */
export function useDeliveryOrder(graph: DeliveryGraph, tidy: number): Ordered | null {
  const [shown, setShown] = useState<{ graph: DeliveryGraph; tidy: number; order: DeliveryOrder } | null>(null);
  const current = shown?.graph === graph && shown.tidy === tidy ? shown : null;
  useEffect(() => {
    if (current) return;
    let live = true;
    const made = ordered(graph, shown !== null && shown.tidy !== tidy);
    const show = (order: DeliveryOrder) => { if (live) setShown({ graph, tidy, order }); };
    if (made instanceof Promise) void made.then(show); else show(made);
    return () => { live = false; };
  }, [graph, tidy, current]);
  return shown ? { order: shown.order, graph: shown.graph } : null;
}
