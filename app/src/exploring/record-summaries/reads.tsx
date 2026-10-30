import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RecordSummaries } from '../../../../lathe/src/exploring/record-summaries/read-model';
import type { FolderTree } from '../../../../lathe/src/exploring/folder-tree/read-model';
import type { ProductProblems } from '../../../../lathe/src/checking/problems/read-model';
import type { ProductCoverage } from '../../../../lathe/src/traceability/coverage/read-model';
import { onLatheEvent } from '../../events';
import { indexMetaModel, type MetaModel } from '../../platform/meta-model/reads';
import { readModelsChanged, useRead, useVersionedRead } from '../../record/read';
import { buildRecordIndex, type RecordIndex } from './record-index';

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
  const input = product ? { product_id: product } : null;
  const meta = useVersionedRead<MetaModel>('/api/meta-model/get-meta-model', {}, version);
  const summaries = useVersionedRead<RecordSummaries>('/api/record-summaries/list-record-summaries', input, version);
  const folders = useRead<FolderTree>('/api/folder-tree/get-folder-tree', input, version);
  const problems = useRead<ProductProblems>('/api/problems/list-problems', input, version);
  const coverage = useRead<ProductCoverage>('/api/coverage/get-coverage', input, version);
  const metaIndex = useMemo(() => (meta.read.state === 'read' ? indexMetaModel(meta.read.answer) : null), [meta.read]);
  const built = useMemo(() => {
    if (!product || !metaIndex || summaries.read.state !== 'read' || summaries.read.answer.product !== product) return null;
    if (folders.state !== 'read' || folders.answer.product !== product) return null;
    return buildRecordIndex(
      metaIndex,
      summaries.read.answer,
      folders.answer,
      problems.state === 'read' && problems.answer.product === product ? problems.answer : null,
      coverage.state === 'read' && coverage.answer.product === product ? coverage.answer : null,
    );
  }, [product, metaIndex, summaries.read, folders, problems, coverage]);
  const refused = [meta.read, summaries.read, folders].find((r) => r.state === 'refused');
  const error = refused?.state === 'refused' ? refused.error : null;
  // A read refused on a reload (the files caught mid-write, or data the store refuses) keeps the space's last index on
  // screen, with the error beside it, as the pages say; only a space never read shows the error alone.
  const last = useRef<RecordIndex | null>(null);
  if (built) last.current = built;
  else if (!error || last.current?.product !== product) last.current = null;
  const index = built ?? last.current;

  // A reload is done once the space's reads answer for its version (or the meta model's, outside every space).
  const answered = Math.min(Number(meta.version ?? -1), product ? Number(summaries.version ?? -1) : Infinity);
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
  const covers = (change: { tables: readonly string[] }, tables: readonly string[]) => tables.every((t) => change.tables.includes(t));
  const reload = useCallback(async (write?: { mark: number; tables: readonly string[] }) => {
    if (!write || !greeted.current) return answeredFor(everything());
    const found = heard.current.slice(write.mark).find((change) => covers(change, write.tables));
    if (found) return answeredFor(found.version);
    const at = await new Promise<number | null>((resolve) => {
      const entry = { ...write, found: (v: number) => resolve(v) };
      writes.current.push(entry);
      setTimeout(() => {
        writes.current = writes.current.filter((w) => w !== entry);
        resolve(null);
      }, WRITE_CHANGE_WAIT_MS);
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
