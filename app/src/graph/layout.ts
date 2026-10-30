import { useEffect, useState } from 'react';
import { pageFaces, type GraphFonts } from './fonts';
import { assembleTree, placeTree, fitCache, type PlacedMap, type TreeGeometry } from './map';
import { assembleNested, placeNested } from './nested';
import { probeOf, type LayoutReply, type LayoutRequest, type MapInput } from './layout-input';
import { textMeasure } from './text';

// Every map is laid out off the page's main thread (LA-PAT-APP-UX-R19, LA-PAT-APP-UX-R11): the Graph's Tree and Nested
// maps and the Trace stage's, in the layout's worker (layout.worker.ts), and only when what the map reads has changed
// (layout-input.ts: its packed input is its key), never on a reload that left it alone. While a new layout is made, the
// map before it stays on screen and answers the camera and the pointer; it is swapped for the new one when that arrives.
// Where there is no worker (the unit tests, in jsdom), or the worker's measure does not match the page's (its faces did
// not load), the same layout runs on the page's thread instead, as ELK does (elk.ts).

/** The layouts made lately, by their input: switching back to a product or a layout, or new data that changes nothing the map reads, reads one at once. */
const done = new Map<string, PlacedMap>();
const KEEP = 6;
const remember = (packed: string, map: PlacedMap) => {
  done.delete(packed);
  done.set(packed, map);
  if (done.size > KEEP) done.delete(done.keys().next().value!);
  return map;
};

const assemble = (input: MapInput, geometry: TreeGeometry): PlacedMap =>
  input.view === 'tree' ? assembleTree(input.shape, (i) => input.labels[i], geometry) : assembleNested(input.shape, (i) => input.labels[i], geometry);

/** The page thread's fits (map.ts FitCache), kept across its layouts as the worker keeps its own. */
const fits = fitCache();
/** A map laid out on the page's thread. */
function layOutHere(input: MapInput): PlacedMap {
  const labelOf = (i: number) => input.labels[i];
  const start = performance.now();
  const geometry = input.view === 'tree' ? placeTree(input.shape, labelOf, fits) : placeNested(input.shape, labelOf);
  last = { thread: 'page', ms: performance.now() - start, nodes: input.labels.length, count: (last?.count ?? 0) + 1 };
  return remember(input.packed, assemble(input, geometry));
}

interface Host { post: (input: MapInput) => Promise<PlacedMap | null> }

/** The last layout made: where, how long it took to place its boxes, how many it placed, and how many layouts the page has made (the scene reports it, for the perf suite). */
let last: { thread: 'worker' | 'page'; ms: number; nodes: number; count: number } | null = null;
export const lastLayout = () => last;

/**
 * The worker, once it has loaded the page's faces and measures as the page does; null where there is none to use. It
 * lays one map out at a time; of the inputs waiting for one map (its view and root), only the latest is laid out, the
 * ones it replaced answering null, so a burst of reloads makes one layout, not one each.
 */
let host: Promise<Host | null> | null = null;
function startHost(fonts: GraphFonts): Promise<Host | null> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    let worker: Worker;
    try { worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' }); } catch { resolve(null); return; }
    type Job = { id: number; input: MapInput; done: (map: PlacedMap | null) => void };
    const queued = new Map<string, Job>();
    let running: Job | null = null;
    let next = 0;
    const slot = (input: MapInput) => `${input.view}|${input.shape.roots.join(' ')}`;
    const pump = () => {
      if (running) return;
      const job = queued.values().next().value;
      if (!job) return;
      queued.delete(slot(job.input));
      running = job;
      const { input } = job;
      worker.postMessage({ type: 'layout', id: job.id, view: input.view, packed: input.packed, roots: input.shape.roots.map((r) => input.shape.ids.indexOf(r)) } satisfies LayoutRequest);
    };
    const post = (input: MapInput) => new Promise<PlacedMap | null>((done) => {
      const key = slot(input);
      queued.get(key)?.done(null);
      queued.set(key, { id: next++, input, done });
      pump();
    });
    worker.onerror = () => {
      // A worker that fails lays nothing out again: what it was laying out is laid out here.
      worker.terminate();
      host = Promise.resolve(null);
      for (const job of [...(running ? [running] : []), ...queued.values()]) job.done(layOutHere(job.input));
      running = null;
      queued.clear();
      resolve(null);
    };
    worker.onmessage = (e: MessageEvent<LayoutReply>) => {
      const reply = e.data;
      if (reply.type === 'ready') {
        // The worker must fit labels exactly as the page draws them.
        const own = probeOf(textMeasure());
        const same = reply.measure === textMeasure().key && reply.probe.every((w, i) => Math.abs(w - own[i]) < 1e-9);
        if (!same) { worker.terminate(); resolve(null); return; }
        resolve({ post });
        return;
      }
      const job = running;
      running = null;
      if (job && job.id === reply.id) {
        last = { thread: 'worker', ms: reply.ms, nodes: job.input.labels.length, count: (last?.count ?? 0) + 1 };
        job.done(remember(job.input.packed, assemble(job.input, reply)));
      }
      pump();
    };
    worker.postMessage({ type: 'fonts', fonts, faces: pageFaces() } satisfies LayoutRequest);
  });
}

/** A map's layout: at once when it was made lately; else from the worker, or laid out here where there is none. */
const pending = new Map<string, Promise<PlacedMap | null>>();
function layOut(input: MapInput, fonts: GraphFonts): PlacedMap | Promise<PlacedMap | null> {
  const known = done.get(input.packed);
  if (known) return known;
  if (typeof Worker === 'undefined') return layOutHere(input);
  let laying = pending.get(input.packed);
  if (!laying) {
    host ??= startHost(fonts);
    laying = host.then((h) => (h ? h.post(input) : layOutHere(input)));
    pending.set(input.packed, laying);
    void laying.finally(() => pending.delete(input.packed));
  }
  return laying;
}

/**
 * The map for an input, with what it was made for (`of`: the index its plates are read from): the input's own once it
 * is laid out; until then the one shown before, which stays on screen and answers the camera; null before the first.
 */
export function useLaidOut<M extends PlacedMap, T>(input: MapInput | null, of: T, fonts: GraphFonts): { map: M; of: T } | null {
  const [shown, setShown] = useState<{ packed: string; map: M; of: T } | null>(null);
  const now = input ? layOut(input, fonts) : null;
  const ready = now && !(now instanceof Promise) ? now as M : null;
  useEffect(() => {
    if (!input) return;
    if (ready) { if (shown?.map !== ready) setShown({ packed: input.packed, map: ready, of }); return; }
    let live = true;
    void (now as Promise<PlacedMap | null>).then((map) => { if (live && map) setShown({ packed: input.packed, map: map as M, of }); });
    return () => { live = false; };
  }, [input, of]);
  if (!input) return null;
  if (ready) return { map: ready, of };
  return shown ? { map: shown.map, of: shown.of } : null;
}
