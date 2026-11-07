import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onLatheEvent } from '../../events';
import { indexMetaModel, type MetaModel } from '../../platform/meta-model/reads';
import { forgetWithReads, readModelChanges, readModelsChanged, useVersionedRead } from '../../record/read';
import { indexOf, type RecordIndex } from './record-index';
import { checksOf, forgetMirrors, keepMirroredTree, mirrorOf, NO_COVERAGE, NO_PROBLEMS, putChange, putChecks, type Mirrored, type MirroredChecks } from './space-index';
import { askSpace, metaNumber, tellMeta } from './space-client';

// The data the app shows changes when a write goes through or the files change: each is a new version of the data,
// and each read made for a version reads again for the next when its read model changed (record/read.ts `useRead`). The space's record index
// (record-index.ts) is built from the reads of that version.

export interface DataState {
  /** The data's version: a new one after every write that went through and every change to the files. */
  version: number;
  /** The space's record index for the version, or null while it is read (or outside every space). */
  index: RecordIndex | null;
  /** Why the space could not be read, or null. */
  error: string | null;
  /** Reads the data again, as after a write; resolves once the space's index of the new version is in. */
  reload: () => Promise<void>;
}

/**
 * The product's space index for the data's version: the meta model, the record summaries and the folder tree first,
 * then the problems and coverage as they come. A product of null (the products picker) reads no space.
 */
export function useDataState(product: string | null, { version, reload, answered: settle }: DataVersion): DataState {
  const meta = useVersionedRead<MetaModel>('/api/meta-model/get-meta-model', {}, version);
  const model = meta.read.state === 'read' ? meta.read.answer : null;
  const space = useSpaceLayer(RECORDS, product, version, model);
  const checked = useSpaceLayer(CHECKED, product, version, null);
  const metaIndex = useMemo(() => (meta.read.state === 'read' ? indexMetaModel(meta.read.answer) : null), [meta.read]);
  // The index by layer, each worked out in the space's index worker when its own reads changed and put in by its change
  // (space-index.ts): the records and the folder tree, then the problems and the coverage (empty until read), so an
  // answer for one never builds the others again, and the page never parses or builds a large product's lookups whole.
  const mirrored = space.read.state === 'read' && space.read.mirrored.records.product === product ? space.read.mirrored : null;
  const checks = checked.read.state === 'read' && checked.read.mirrored.product === product ? checked.read.mirrored : null;
  const problemsFor = checks?.problemsFor ?? NO_PROBLEMS;
  const covered = checks?.coverage ?? NO_COVERAGE;
  const built = useMemo(() => {
    if (!mirrored || !metaIndex || !model) return null;
    const index = indexOf(metaIndex, mirrored.records, mirrored.folders, problemsFor, covered);
    keepMirroredTree(index, mirrored, metaNumber(model));
    return index;
  }, [mirrored, metaIndex, model, problemsFor, covered]);
  const refused = [meta.read, space.read].find((r) => r.state === 'refused');
  const error = refused?.state === 'refused' ? refused.error : null;
  // A read refused on a reload (the files caught mid-write, or data the store refuses) keeps the space's last index on
  // screen, with the error beside it, as the pages say; only a space never read shows the error alone.
  const last = useRef<RecordIndex | null>(null);
  if (built) last.current = built;
  else if (!error || last.current?.product !== product) last.current = null;
  const index = built ?? last.current;

  // A reload is done once the space's reads answer for its version (or the meta model's, outside every space).
  const answered = Math.min(Number(meta.version ?? -1), product ? Number(space.version ?? -1) : Infinity);
  useEffect(() => { settle(answered); }, [answered, settle]);
  return { version, index, error, reload };
}

/** The data's version, and the reloads waiting for the reads of theirs. */
export interface DataVersion {
  version: number;
  /**
   * Moves the version on; resolves once the space's reads answer for it. After a write, given the tables it changed
   * and the mark taken before it was sent, it waits for the server's change for that write (the server announces it
   * before it answers), so only the read models it touched read again; with no channel open, every read does.
   */
  reload: (write?: { mark: number; tables: readonly string[] }) => Promise<void>;
  /** A mark of the changes heard so far, taken before a write is sent. */
  mark: () => number;
  /** Tells the reloads waiting that the reads answer for this version. */
  answered: (version: number) => void;
}

/** How long a reload after a write waits for the server's change for it, before every read reads again. */
const WRITE_CHANGE_WAIT_MS = 300;

/**
 * The data's version: moved on by every change the server announces (marking only the read models it names as
 * changed, so only their reads read again) and every reload.
 */
export function useDataVersion(): DataVersion {
  const [version, setVersion] = useState(0);
  const waiting = useRef<{ version: number; done: () => void }[]>([]);
  const versionRef = useRef(version);
  versionRef.current = version;
  // The changes heard, each with the version it moved the data to; and whether the channel is open (it greeted the page).
  const heard = useRef<{ tables: readonly string[]; version: number }[]>([]);
  const greeted = useRef(false);
  const writes = useRef<{ mark: number; tables: readonly string[]; found: (version: number) => void }[]>([]);
  // The version the reads last answered for, and how to wait for the reads of a version to answer.
  const answeredRef = useRef(-1);
  const answeredFor = useCallback((at: number) => new Promise<void>((done) => {
    if (at <= answeredRef.current) done();
    else waiting.current.push({ version: at, done });
  }), []);
  // Every read model changed: the version moves on and each read reads again.
  const everything = useCallback(() => {
    readModelsChanged(null);
    const next = versionRef.current + 1;
    versionRef.current = next;
    setVersion(next);
    return next;
  }, []);
  // The waits of reloads after writes. They stop when the hook unmounts, so none moves the version after it: in a test,
  // the window is gone by the time one would end.
  const waits = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = waits.current;
    return () => {
      for (const wait of pending) clearTimeout(wait);
      pending.clear();
    };
  }, []);
  const covers = (change: { tables: readonly string[] }, tables: readonly string[]) => tables.every((t) => change.tables.includes(t));
  const reload = useCallback(async (write?: { mark: number; tables: readonly string[] }) => {
    if (!write || !greeted.current) return answeredFor(everything());
    const found = heard.current.slice(write.mark).find((change) => covers(change, write.tables));
    if (found) return answeredFor(found.version);
    const at = await new Promise<number | null>((resolve) => {
      const entry = { ...write, found: (v: number) => resolve(v) };
      writes.current.push(entry);
      const wait = setTimeout(() => {
        waits.current.delete(wait);
        writes.current = writes.current.filter((w) => w !== entry);
        resolve(null);
      }, WRITE_CHANGE_WAIT_MS);
      waits.current.add(wait);
    });
    return answeredFor(at ?? everything());
  }, [answeredFor, everything]);
  const mark = useCallback(() => heard.current.length, []);
  const answered = useCallback((at: number) => {
    answeredRef.current = Math.max(answeredRef.current, at);
    const done = waiting.current.filter((w) => w.version <= at);
    waiting.current = waiting.current.filter((w) => w.version > at);
    for (const w of done) w.done();
  }, []);
  useEffect(() => onLatheEvent('spec:changed', (change) => {
    // The greeting when the channel opens changes nothing; a later one (after a reconnect) may follow any change.
    if (change && !change.tables.length && change.readModels?.length === 0) {
      if (!greeted.current) { greeted.current = true; return; }
      everything();
      return;
    }
    readModelsChanged(change?.readModels ?? null);
    const next = versionRef.current + 1;
    versionRef.current = next;
    setVersion(next);
    if (!change) return;
    heard.current.push({ tables: change.tables, version: next });
    for (const w of writes.current.filter((w) => covers(change, w.tables))) {
      writes.current = writes.current.filter((x) => x !== w);
      w.found(next);
    }
  }), [everything]);
  return useMemo(() => ({ version, reload, mark, answered }), [version, reload, mark, answered]);
}

// ---------- The space's index, from its worker ----------

/**
 * One layer of the space's index the builder works out (space-index.ts): the reads it reads, the page's mirror of it, and
 * how the builder is asked for its change from the mirror (each read flagged when its read model changed since).
 */
interface Layer<M> {
  routes: readonly string[];
  mirror: (product: string) => M | undefined;
  ask: (product: string, base: M | undefined, again: boolean[], model: MetaModel | null) => Promise<M | { error: string } | null>;
}

const RECORDS: Layer<Mirrored> = {
  routes: ['/api/record-summaries/list-record-summaries', '/api/folder-tree/get-folder-tree'],
  mirror: mirrorOf,
  ask: async (product, base, [summaries, folders], model) => {
    tellMeta(model!);
    const reply = await askSpace({ type: 'read', product, base: base?.seq ?? null, summaries, folders });
    if (!reply || reply.type !== 'read') return null;
    return 'refused' in reply.change ? { error: reply.change.refused.error } : putChange(reply.change);
  },
};

const CHECKED: Layer<MirroredChecks> = {
  routes: ['/api/problems/list-problems', '/api/coverage/get-coverage'],
  mirror: checksOf,
  ask: async (product, base, [problems, coverage]) => {
    const reply = await askSpace({ type: 'checked', product, base: base?.seq ?? null, problems, coverage });
    return reply && reply.type === 'checked' ? putChecks(reply.change) : null;
  },
};

/** What each layer last read, by product: the read models' changes then (and the meta model's number), so a version that left them alone reads nothing. */
const readFor = new Map<Layer<unknown>, Map<string, string[]>>();
forgetWithReads(() => { forgetMirrors(); readFor.clear(); });

type LayerRead<M> = { state: 'reading' } | { state: 'read'; mirrored: M } | { state: 'refused'; error: string };

/**
 * A layer of the space's index for the data's version, as the builder's changes made it: read again when one of its
 * read models changed since it was read (LA-PLT-UC03-R02), or the meta model did, one read at a time; until it answers,
 * the mirror read before stays on screen.
 */
function useSpaceLayer<M>(layer: Layer<M>, product: string | null, version: number, model: MetaModel | null): { read: LayerRead<M>; version: number | undefined } {
  const held = (p: string | null): LayerRead<M> => { const m = p ? layer.mirror(p) : undefined; return m ? { state: 'read', mirrored: m } : { state: 'reading' }; };
  const [state, setState] = useState<{ product: string | null; read: LayerRead<M>; version: number | undefined }>(() => ({ product, read: held(product), version: undefined }));
  // One read at a time, the latest version wanted read next; nothing is set once the page has gone.
  const running = useRef<Promise<void> | null>(null);
  const wanted = useRef<{ product: string; version: number; model: MetaModel | null } | null>(null);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const needsMeta = layer === (RECORDS as unknown as Layer<M>);
  useEffect(() => {
    if (!product || (needsMeta && !model)) return;
    wanted.current = { product, version, model };
    const run = async () => {
      while (wanted.current) {
        const want = wanted.current;
        wanted.current = null;
        const stamps = [...layer.routes.map(readModelChanges), needsMeta ? String(metaNumber(want.model!)) : ''];
        let byProduct = readFor.get(layer as Layer<unknown>);
        if (!byProduct) { byProduct = new Map(); readFor.set(layer as Layer<unknown>, byProduct); }
        const last = byProduct.get(want.product);
        const mirrored = layer.mirror(want.product);
        const set = (read: LayerRead<M>) => { if (live.current) setState({ product: want.product, read, version: want.version }); };
        if (mirrored && last && stamps.every((s, i) => s === last[i])) { set({ state: 'read', mirrored }); continue; }
        const answer = await layer.ask(want.product, mirrored, layer.routes.map((_, i) => !mirrored || last?.[i] !== stamps[i]), want.model);
        if (!answer) continue;
        if ('error' in (answer as object)) { set({ state: 'refused', error: (answer as { error: string }).error }); continue; }
        byProduct.set(want.product, stamps);
        set({ state: 'read', mirrored: answer as M });
      }
    };
    if (!running.current) running.current = run().finally(() => { running.current = null; });
  }, [product, version, model]);
  if (state.product !== product) return { read: held(product), version: undefined };
  return { read: state.read, version: state.version };
}
