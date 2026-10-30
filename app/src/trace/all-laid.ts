import { useEffect, useState } from 'react';
import type { AllGraph } from './all';
import { BOX_HEIGHT, BOX_WIDTH, columnLeft, layOutColumns, type LayoutInput, type LayoutResult } from './all-layout';

// The All-at-once view's layout off the page's main thread (LA-PAT-APP-UX-R19, as graph/layout.ts lays the Graph's
// maps out): its order and places are worked out in its worker (all-layout.worker.ts), again only when what they read
// changes (the boxes, their sections and their links: the input's key), and never on a reload that left them alone.
// While a new layout is made, the one before stays on screen with the graph it was made from. Each product's last
// layout is kept for the page's life: a new one keeps every box shown before at its place and in its order
// (all-layout.ts placeKept, LA-PAT-APP-UX-R22) until Tidy up lays the columns out afresh, and switching back to the
// stage reads it at once. Where there is no worker (the unit tests, in jsdom), the same layout runs on the page.

/** One box's place, in map units. */
export interface BoxPlace { x: number; y: number; w: number; h: number }

/** A laid-out All-at-once view: each column's keys top to bottom, each box's place, the top of the boxes under no outcome, and its size. */
export interface AllLaid {
  key: string;
  order: readonly (readonly string[])[];
  places: ReadonlyMap<string, BoxPlace>;
  outsideTop: number | null;
  width: number;
  height: number;
}

/** Each graph's input, numbered once (its key hashes every box and link). */
const inputs = new WeakMap<AllGraph, { input: Omit<LayoutInput, 'previous'>; keys: string[]; number: Map<string, number>; key: string }>();

/** A graph's layout input, numbered, and its key: what the layout reads; with the order shown before by number. */
function inputOf(graph: AllGraph, previous: AllLaid | null): { input: LayoutInput; keys: string[]; key: string } {
  let made = inputs.get(graph);
  if (!made) { made = numbered(graph); inputs.set(graph, made); }
  const { number } = made;
  const was = previous ? previous.order.map((c) => c.filter((k) => number.has(k)).map((k) => number.get(k)!)) : null;
  return { input: { ...made.input, previous: was, kept: previous ? keptOf(made, previous) : null }, keys: made.keys, key: made.key };
}

/** Each box's top in the layout shown before, by number: NaN for a box it did not show, or showed in another column or section. */
function keptOf(made: { input: Omit<LayoutInput, 'previous'>; keys: string[] }, previous: AllLaid): { y: Float64Array; outsideTop: number | null } {
  const { columnOf, under } = made.input;
  const y = new Float64Array(made.keys.length).fill(NaN);
  made.keys.forEach((k, i) => {
    const p = previous.places.get(k);
    if (!p || p.x !== columnLeft(columnOf[i])) return;
    const wasUnder = previous.outsideTop === null || p.y < previous.outsideTop;
    if (wasUnder === (under[i] === 1)) y[i] = p.y;
  });
  return { y, outsideTop: previous.outsideTop };
}

function numbered(graph: AllGraph) {
  const keys: string[] = [];
  const number = new Map<string, number>();
  const columns = graph.columns.map((c) => c.map((k) => { number.set(k, keys.length); keys.push(k); return keys.length - 1; }));
  const columnOf = new Int32Array(keys.length);
  const under = new Uint8Array(keys.length);
  keys.forEach((k, i) => { const n = graph.nodes.get(k)!; columnOf[i] = n.column; under[i] = n.under ? 1 : 0; });
  const links = new Int32Array(graph.links.length * 2);
  graph.links.forEach((l, i) => { links[2 * i] = number.get(l.from)!; links[2 * i + 1] = number.get(l.to)!; });
  // The key: FNV-1a over every box, its column and section, and every link.
  let h = 0x811c9dc5;
  const mix = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } };
  keys.forEach((k, i) => mix(`${k}\u0000${columnOf[i]}${under[i]}\u0001`));
  for (const l of graph.links) mix(`${l.from}>${l.to}\u0002`);
  const key = `${graph.product}|${keys.length}|${graph.links.length}|${(h >>> 0).toString(36)}`;
  return { input: { columns, columnOf, under, links }, keys, number, key };
}

/** A layout's numbers as places by key. */
function laidOf(key: string, keys: readonly string[], result: LayoutResult): AllLaid {
  const places = new Map<string, BoxPlace>();
  keys.forEach((k, i) => places.set(k, { x: 0, y: result.y[i], w: BOX_WIDTH, h: BOX_HEIGHT }));
  const order = result.order.map((c, column) => c.map((b) => { const k = keys[b]; places.get(k)!.x = columnLeft(column); return k; }));
  return { key, order, places, outsideTop: result.outsideTop, width: columnLeft(result.order.length - 1) + BOX_WIDTH, height: result.height };
}

/** Each product's last layout, kept for the page's life: what a new one keeps the order of. */
const lastOf = new Map<string, AllLaid>();
/** A product's layout shown last, if any: the walk's columns. */
export const shownLayout = (product: string): AllLaid | null => lastOf.get(product) ?? null;

/** The last layout made: where, how long it took and how many boxes it placed (the scene reports it, for the perf suite). */
let last: { thread: 'worker' | 'page'; ms: number; boxes: number; count: number } | null = null;
export const lastAllLayout = () => last;

let worker: Worker | null | undefined;
let next = 0;
const waiting = new Map<number, (result: LayoutResult | null) => void>();
function workerOf(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === 'undefined') return (worker = null);
  try {
    worker = new Worker(new URL('./all-layout.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return (worker = null);
  }
  worker.onmessage = (e: MessageEvent<{ id: number; result: LayoutResult; ms: number }>) => {
    const done = waiting.get(e.data.id);
    waiting.delete(e.data.id);
    last = { thread: 'worker', ms: e.data.ms, boxes: e.data.result.y.length, count: (last?.count ?? 0) + 1 };
    done?.(e.data.result);
  };
  worker.onerror = () => {
    // A worker that fails lays nothing out again: what it was laying out is laid out here.
    worker?.terminate();
    worker = null;
    for (const done of waiting.values()) done(null);
    waiting.clear();
  };
  return worker;
}

/** A layout made on the page. */
function here(input: LayoutInput): LayoutResult {
  const start = performance.now();
  const result = layOutColumns(input);
  last = { thread: 'page', ms: performance.now() - start, boxes: input.columnOf.length, count: (last?.count ?? 0) + 1 };
  return result;
}

/** A graph laid out on the page's thread, keeping the order of a layout before it (none orders afresh): the worker's rule, for tests. */
export function layOutGraph(graph: AllGraph, previous: AllLaid | null): AllLaid {
  const { input, keys, key } = inputOf(graph, previous);
  return laidOf(key, keys, layOutColumns(input));
}

/** The layout of a graph: at once when it is the one shown (or on the page with no worker), else from the worker. */
function layOut(graph: AllGraph, tidy: boolean): AllLaid | Promise<AllLaid> {
  const shown = lastOf.get(graph.product) ?? null;
  const previous = tidy ? null : shown;
  const { input, keys, key } = inputOf(graph, previous);
  if (previous && previous.key === key) return previous;
  const keep = (result: LayoutResult) => { const laid = laidOf(key, keys, result); lastOf.set(graph.product, laid); return laid; };
  const w = workerOf();
  if (!w) return keep(here(input));
  return new Promise((resolve) => {
    const id = next++;
    waiting.set(id, (result) => resolve(keep(result ?? here(input))));
    w.postMessage({ id, input });
  });
}

/** What the scene draws: a layout and the graph it was made from. */
export interface Laid { laid: AllLaid; graph: AllGraph }

/**
 * The layout for a graph: the graph's own once laid out; until then the one shown before, which stays on screen; null
 * before the first. `tidy` (a count Tidy up raises) lays the columns out afresh once.
 */
export function useAllLaidOut(graph: AllGraph, tidy: number): Laid | null {
  const [shown, setShown] = useState<{ graph: AllGraph; tidy: number; laid: AllLaid } | null>(null);
  const current = shown?.graph === graph && shown.tidy === tidy ? shown : null;
  useEffect(() => {
    if (current) return;
    let live = true;
    const made = layOut(graph, shown !== null && shown.tidy !== tidy);
    const show = (laid: AllLaid) => { if (live) setShown({ graph, tidy, laid }); };
    if (made instanceof Promise) void made.then(show); else show(made);
    return () => { live = false; };
  }, [graph, tidy, current]);
  return shown ? { laid: shown.laid, graph: shown.graph } : null;
}
