import { useEffect, useState } from 'react';
import { pageFaces, type GraphFonts } from './fonts';
import { assembleTree, placeTree, fitCache, type FitCache, type PlacedMap, type TreeGeometry, type TreeShape } from './map';
import { assembleNested, placeNested } from './nested';
import { assembleGround, keptGround, placeGround, type GroundMap, type GroundRole } from './ground';
import { probeOf, type LayoutReply, type LayoutRequest, type MapInput } from './layout-input';
import { textMeasure, type MapLabel } from './text';

// Every map is laid out off the page's main thread (LA-PAT-APP-UX-R19, LA-PAT-APP-UX-R11): the Graph's Tree, Nested and
// Map maps and the Trace stage's, in the layout's worker (layout.worker.ts), and only when what the map reads has changed
// (layout-input.ts: its packed input is its key), never on a reload that left it alone. While a new layout is made, the
// map before it stays on screen and answers the camera and the pointer; it is swapped for the new one when that arrives.
// Where there is no worker (the unit tests, in jsdom), or the worker's measure does not match the page's (its faces did
// not load), the same layout runs on the page's thread instead, as ELK does (elk.ts). The Map, laid out bottom-up,
// keeps every box of the product's Map shown before where it was (ground.ts, LA-PAT-APP-UX-R22), until Tidy up
// (`tidyGround`) lays it out afresh.

/** The layouts made lately, by their input: switching back to a product or a layout, or new data that changes nothing the map reads, reads one at once. */
const done = new Map<string, PlacedMap>();
const KEEP = 6;
const remember = (packed: string, map: PlacedMap) => {
  done.delete(packed);
  done.set(packed, map);
  if (done.size > KEEP) done.delete(done.keys().next().value!);
  return map;
};

function assemble(input: MapInput, geometry: TreeGeometry): PlacedMap {
  const labelOf = (i: number) => input.labels[i];
  if (input.view === 'tree') return assembleTree(input.shape, labelOf, geometry);
  if (input.view === 'map') return assembleGround(input.shape, labelOf, (i) => input.roles[i], geometry);
  return assembleNested(input.shape, labelOf, geometry);
}

/** A map's boxes, laid out by its view's rule (placeTree's, placeNested's or placeGround's, keeping `kept`). */
function place(view: MapInput['view'], shape: TreeShape, labelOf: (i: number) => MapLabel, roleOf: (i: number) => GroundRole, cache: FitCache, kept: Float64Array | null): TreeGeometry {
  if (view === 'tree') return placeTree(shape, labelOf, cache);
  if (view === 'map') return placeGround(shape, labelOf, roleOf, kept);
  return placeNested(shape, labelOf);
}

/** The page thread's fits (map.ts FitCache), kept across its layouts as the worker keeps its own. */
const fits = fitCache();
/** A map laid out on the page's thread. */
function layOutHere(input: MapInput, kept: Float64Array | null): PlacedMap {
  const labelOf = (i: number) => input.labels[i];
  const start = performance.now();
  const geometry = place(input.view, input.shape, labelOf, (i) => input.roles[i], fits, kept);
  last = { thread: 'page', ms: performance.now() - start, nodes: input.labels.length, count: (last?.count ?? 0) + 1 };
  return remember(input.packed, assemble(input, geometry));
}

interface Host { post: (input: MapInput, kept: Float64Array | null) => Promise<PlacedMap | null> }

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
    type Job = { id: number; input: MapInput; kept: Float64Array | null; done: (map: PlacedMap | null) => void };
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
      worker.postMessage({ type: 'layout', id: job.id, view: input.view, packed: input.packed, roots: input.shape.roots.map((r) => input.shape.ids.indexOf(r)), kept: job.kept } satisfies LayoutRequest);
    };
    const post = (input: MapInput, kept: Float64Array | null) => new Promise<PlacedMap | null>((done) => {
      const key = slot(input);
      queued.get(key)?.done(null);
      queued.set(key, { id: next++, input, kept, done });
      pump();
    });
    worker.onerror = () => {
      // A worker that fails lays nothing out again: what it was laying out is laid out here.
      worker.terminate();
      host = Promise.resolve(null);
      for (const job of [...(running ? [running] : []), ...queued.values()]) job.done(layOutHere(job.input, job.kept));
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

/**
 * Each product's Map shown last, by its roots: what a new one keeps its boxes from (ground.ts keptGround), with the
 * input it was laid out for; and the products whose next Map is laid out afresh (Tidy up).
 */
const grounds = new Map<string, { packed: string; map: GroundMap; made: number }>();
const afresh = new Set<string>();
let made = 0;
const groundSlot = (input: MapInput) => input.shape.roots.join(' ');

/** Tidy up (LA-PAT-APP-UX-R22): the product's next Map laid out afresh, packed in reading order; every later change keeps its places from it. */
export function tidyGround(input: MapInput) { afresh.add(groundSlot(input)); }

/** A map's layout: at once when it was made lately; else from the worker, or laid out here where there is none. */
const pending = new Map<string, Promise<PlacedMap | null>>();
function layOut(input: MapInput, fonts: GraphFonts): PlacedMap | Promise<PlacedMap | null> {
  let kept: Float64Array | null = null;
  let key = input.packed;
  if (input.view === 'map') {
    const slot = groundSlot(input);
    const was = afresh.has(slot) ? undefined : grounds.get(slot);
    if (was && was.packed === input.packed) return was.map;
    kept = was ? keptGround(input.shape, was.map) : null;
    key = `${input.packed}\u0002${was ? was.made : 'afresh'}`;
    const keep = (map: PlacedMap | null) => {
      if (map) { afresh.delete(slot); grounds.set(slot, { packed: input.packed, map: map as GroundMap, made: made++ }); }
      return map;
    };
    if (typeof Worker === 'undefined') return keep(layOutHere(input, kept))!;
    let laying = pending.get(key);
    if (!laying) {
      host ??= startHost(fonts);
      laying = host.then((h) => (h ? h.post(input, kept) : layOutHere(input, kept))).then(keep);
      pending.set(key, laying);
      void laying.finally(() => pending.delete(key));
    }
    return laying;
  }
  const known = done.get(key);
  if (known) return known;
  if (typeof Worker === 'undefined') return layOutHere(input, null);
  let laying = pending.get(key);
  if (!laying) {
    host ??= startHost(fonts);
    laying = host.then((h) => (h ? h.post(input, null) : layOutHere(input, null)));
    pending.set(key, laying);
    void laying.finally(() => pending.delete(key));
  }
  return laying;
}

/**
 * The map for an input, with what it was made for (`of`: the index its plates are read from): the input's own once it
 * is laid out; until then the one shown before, which stays on screen and answers the camera; null before the first.
 * `tidy`, a count Tidy up raises after `tidyGround`, lays the Map out again.
 */
export function useLaidOut<M extends PlacedMap, T>(input: MapInput | null, of: T, fonts: GraphFonts, tidy = 0): { map: M; of: T } | null {
  const [shown, setShown] = useState<{ packed: string; map: M; of: T } | null>(null);
  const now = input ? layOut(input, fonts) : null;
  const ready = now && !(now instanceof Promise) ? now as M : null;
  useEffect(() => {
    if (!input) return;
    if (ready) { if (shown?.map !== ready) setShown({ packed: input.packed, map: ready, of }); return; }
    let live = true;
    void (now as Promise<PlacedMap | null>).then((map) => { if (live && map) setShown({ packed: input.packed, map: map as M, of }); });
    return () => { live = false; };
  }, [input, of, tidy]);
  if (!input) return null;
  if (ready) return { map: ready, of };
  return shown ? { map: shown.map, of: shown.of } : null;
}
