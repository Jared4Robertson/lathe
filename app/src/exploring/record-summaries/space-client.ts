import type { MetaModel } from '../../platform/meta-model/reads';
import type { SpaceReply, SpaceRequest } from './space-index';

// How the page asks the space's index builder (space-index.ts): its worker (space-index.worker.ts), or where there is
// none (the unit tests, in jsdom) the builder on this thread, loaded when first asked. Each request but the meta model's
// is answered once, in the order the worker answers it.

/** A request as the page sends it: the client numbers it. */
type Asked = SpaceRequest extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : R) : never;
type Ask = (request: SpaceRequest) => Promise<SpaceReply | null>;

let asking: { ask: Ask; worker: boolean } | null = null;
let told: SpaceRequest | null = null;
let asked = 0;

const here = (): { ask: Ask; worker: boolean } => {
  const builder = import('./space-builder').then(async ({ spaceBuilder }) => {
    const { readAnswer } = await import('../../record/query');
    return spaceBuilder((address) => readAnswer(address));
  });
  return { ask: async (request) => (await builder)(request), worker: false };
};

function client(): { ask: Ask; worker: boolean } {
  if (asking) return asking;
  if (typeof Worker === 'undefined') return (asking = here());
  let worker: Worker;
  try { worker = new Worker(new URL('./space-index.worker.ts', import.meta.url), { type: 'module' }); } catch { return (asking = here()); }
  const waiting = new Map<number, { request: SpaceRequest; done: (reply: SpaceReply | null) => void }>();
  worker.onmessage = (e: MessageEvent<SpaceReply>) => {
    const w = waiting.get(e.data.id);
    waiting.delete(e.data.id);
    w?.done(e.data);
  };
  worker.onerror = () => {
    // A worker that fails builds nothing again: the builder on this thread answers what it was asked, from nothing.
    worker.terminate();
    asking = here();
    const again = asking.ask;
    void (told ? again(told) : Promise.resolve(null)).then(() => {
      for (const { request, done } of waiting.values()) void again(request.type === 'read' ? { ...request, base: null } : request).then(done);
      waiting.clear();
    });
  };
  const ask: Ask = (request) => {
    if (request.type === 'meta') { worker.postMessage(request); return Promise.resolve(null); }
    return new Promise((done) => { waiting.set(request.id, { request, done }); worker.postMessage(request); });
  };
  return (asking = { ask, worker: true });
}

/** Whether the builder runs in its worker (else on this thread). */
export const spaceInWorker = (): boolean => client().worker;

/** Asks the builder; the answer comes once the builder has worked it out. */
export function askSpace(request: Asked): Promise<SpaceReply | null> {
  return client().ask(request.type === 'meta' ? request : ({ ...request, id: ++asked } as SpaceRequest));
}

/** Each meta model answer by a number of its own, so the builder and the page name the one a tree was worked out with. */
const metaNumbers = new WeakMap<MetaModel, number>();
let metas = 0;
export function metaNumber(model: MetaModel): number {
  let n = metaNumbers.get(model);
  if (n === undefined) { n = ++metas; metaNumbers.set(model, n); }
  return n;
}

/** Tells the builder the meta model, once per answer, before the reads that use it. */
let toldMeta = 0;
export function tellMeta(model: MetaModel) {
  const number = metaNumber(model);
  if (number === toldMeta) return;
  toldMeta = number;
  told = { type: 'meta', meta: model, number };
  void client().ask(told);
}
