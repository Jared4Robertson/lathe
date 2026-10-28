// Lathe's HTTP API, shared by `lathe serve`, the desktop shell and the app's Vite dev server. Its shapes are in
// contract.ts:
//   GET  /api/spec                SpecData: the schema, every stored table's rows, and the checks' problems and coverage
//   POST /api/write               { commands } -> WriteAnswer: one transaction through the store's command layer
//   GET  /api/history?id=<ID>     HistoryAnswer: the commits that changed the record's rows (&skip=<n> for older ones)
//   GET  /api/reference           the product's Reference (reference.ts): kinds, tables, relations, folders, checks
//
// The store of each product root is opened once and kept (on globalThis, so it outlives a reload of this module in
// the dev server). Before each request the data folder's files are compared with what the store last read or wrote;
// a change made by anything else (an editor, git) opens the store afresh.
import { existsSync, readdirSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { loadConfig } from '../config.ts';
import { buildReference, loadWorkspace } from '../index.ts';
import { describeKey, rowKey, type Row } from '../store/rows.ts';
import { formatProblem, LATHE_DATA_DIR, openStore, StoreError, type Command, type Store } from '../store/store.ts';
import type { Coverage, Problem } from '../types.ts';
import type { RowChange, SpecData, WriteAnswer, WriteRequest } from './contract.ts';
import { recordHistory } from './history.ts';

/** The most a write's body may hold. */
export const WRITE_BODY_LIMIT = 1024 * 1024;
/** The most commands one write may hold. */
export const WRITE_COMMAND_LIMIT = 500;

interface Opened {
  store: Store;
  /** The data folder's files as the store last read or wrote them. */
  signature: string;
  /** The checks' problems and coverage for this data, once worked out. */
  checks: Promise<{ problems: Problem[]; coverage: Coverage[] }> | null;
  /** Requests on this root run one after another, so a write never races a reload. */
  queue: Promise<unknown>;
}

const STORES_KEY = Symbol.for('lathe.server.stores');
const stores: Map<string, Promise<Opened>> = ((globalThis as Record<symbol, unknown>)[STORES_KEY] as Map<string, Promise<Opened>> | undefined) ??
  ((globalThis as Record<symbol, unknown>)[STORES_KEY] = new Map<string, Promise<Opened>>());

/** The data folder's .jsonl files, their sizes and modification times, as one string. */
export function dataSignature(dataDir: string): string {
  if (!existsSync(dataDir)) return '';
  return readdirSync(dataDir)
    .filter((f) => f.endsWith('.jsonl'))
    .sort()
    .map((f) => {
      const s = statSync(path.join(dataDir, f));
      return `${f}:${s.size}:${s.mtimeMs}`;
    })
    .join('\n');
}

// What the store read: the product's data folder and Lathe's own (its checks), loaded beside it.
const storeSignature = (dataDir: string) => `${dataSignature(dataDir)}\n--\n${dataSignature(LATHE_DATA_DIR)}`;

// Runs a task on the root's opened store, after every task before it, opening the store afresh when its files
// changed under it.
async function withStore<T>(root: string, task: (opened: Opened) => Promise<T>): Promise<T> {
  const dataDir = loadConfig(root).dataDir;
  let pending = stores.get(root);
  if (!pending) {
    pending = (async () => {
      const signature = storeSignature(dataDir);
      return { store: await openStore(root), signature, checks: null, queue: Promise.resolve() };
    })();
    stores.set(root, pending);
    pending.catch(() => stores.delete(root));
  }
  const opened = await pending;
  const run = opened.queue.then(async () => {
    if (storeSignature(dataDir) !== opened.signature) {
      const signature = storeSignature(dataDir);
      const fresh = await openStore(root);
      await opened.store.close().catch(() => undefined);
      opened.store = fresh;
      opened.signature = signature;
      opened.checks = null;
    }
    return task(opened);
  });
  opened.queue = run.catch(() => undefined);
  return run;
}

/**
 * Closes the stores this process opened, or the one of a root (for tests and a server shutting down), each once the
 * request it is serving (a load, a reload or a write) has finished.
 */
export async function closeStores(root?: string): Promise<void> {
  const roots = root ? [loadConfig(root).root] : [...stores.keys()];
  const all = roots.flatMap((r) => { const s = stores.get(r); stores.delete(r); return s ? [s] : []; });
  for (const pending of all) {
    try {
      const opened = await pending;
      await opened.queue;
      await opened.store.close();
    } catch {
      // A store that never opened has nothing to close.
    }
  }
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const storeMessage = (error: unknown) => (error instanceof StoreError ? error.problems.map(formatProblem).join('\n') : message(error));

async function checksOf(root: string): Promise<{ problems: Problem[]; coverage: Coverage[] }> {
  try {
    const workspace = await loadWorkspace(root);
    return { problems: workspace.problems, coverage: workspace.coverage };
  } catch (error) {
    return { problems: [{ severity: 'error', check: 'engine', record: null, message: `The checks could not run: ${message(error)}` }], coverage: [] };
  }
}

/** Every stored table's rows, for the tables that have any. */
function tablesOf(store: Store): Record<string, Row[]> {
  const tables: Record<string, Row[]> = {};
  for (const [name, table] of Object.entries(store.schema.tables)) {
    if (!table.stored) continue;
    const rows = store.rows(name);
    if (rows.length) tables[name] = rows;
  }
  return tables;
}

async function specData(root: string): Promise<SpecData> {
  const config = loadConfig(root);
  return withStore(config.root, async (opened) => {
    opened.checks ??= checksOf(config.root);
    const { problems, coverage } = await opened.checks;
    return {
      schema: opened.store.schema,
      dataDir: path.relative(config.root, config.dataDir).split(path.sep).join('/'),
      tables: tablesOf(opened.store),
      problems,
      coverage,
    };
  });
}

// ---------- Writing ----------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isKey = (v: unknown) => isText(v) || isObject(v);

/** Why the body is not a write request, or null when it is one. */
export function writeRequestProblem(body: unknown): string | null {
  if (!isObject(body) || !Array.isArray(body.commands)) return 'A write is a JSON object { "commands": [...] }.';
  const { commands } = body;
  if (commands.length < 1 || commands.length > WRITE_COMMAND_LIMIT) return `A write holds 1 to ${WRITE_COMMAND_LIMIT} commands.`;
  for (const [i, c] of commands.entries()) {
    const at = `Command ${i + 1}`;
    if (!isObject(c)) return `${at} is not an object.`;
    switch (c.op) {
      case 'add':
        if (!isText(c.table) || !isObject(c.row)) return `${at}: add takes a table and a row.`;
        break;
      case 'set':
        if (!isText(c.table) || !isKey(c.key) || !isObject(c.changes)) return `${at}: set takes a table, a key and changes.`;
        break;
      case 'move':
        if (!isText(c.id) || !isText(c.parent)) return `${at}: move takes an id and a parent.`;
        break;
      case 'link':
      case 'unlink':
        if (!isText(c.relation) || !isText(c.source) || !isText(c.target)) return `${at}: ${c.op} takes a relation, a source and a target.`;
        break;
      case 'remove':
        if (!isText(c.table) || !isKey(c.key)) return `${at}: remove takes a table and a key.`;
        break;
      default:
        return `${at}: the op is one of add, set, move, link, unlink and remove.`;
    }
  }
  return null;
}

/** Whether the request comes from another site: its Origin names another host, or the browser says so. */
function crossSite(req: IncomingMessage): boolean {
  if (req.headers['sec-fetch-site'] === 'cross-site') return true;
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.host;
  } catch {
    return true;
  }
}

class BodyTooLarge extends Error {}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    req.on('data', (chunk: Buffer) => {
      if (done) return;
      size += chunk.length;
      if (size > limit) {
        done = true;
        reject(new BodyTooLarge());
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks).toString('utf8')); } });
    req.on('error', (error) => { if (!done) { done = true; reject(error); } });
  });
}

/** The rows of the tables a write changed, before and after, paired by primary key. */
function rowChanges(store: Store, before: Map<string, Row[]>, tables: string[]): RowChange[] {
  const changes: RowChange[] = [];
  for (const name of tables) {
    const table = store.schema.tables[name];
    if (!table) continue;
    const old = new Map((before.get(name) ?? []).map((r) => [rowKey(table, r), r]));
    const now = new Map(store.rows(name).map((r) => [rowKey(table, r), r]));
    for (const [key, row] of now) {
      const was = old.get(key);
      if (!was) changes.push({ table: name, key: describeKey(table, row), before: null, after: row });
      else if (JSON.stringify(was) !== JSON.stringify(row)) changes.push({ table: name, key: describeKey(table, row), before: was, after: row });
    }
    for (const [key, row] of old) if (!now.has(key)) changes.push({ table: name, key: describeKey(table, row), before: row, after: null });
  }
  return changes;
}

async function write(root: string, commands: Command[]): Promise<{ status: number; answer: WriteAnswer }> {
  const config = loadConfig(root);
  return withStore(config.root, async (opened) => {
    const { store } = opened;
    const before = new Map(Object.keys(store.schema.tables).filter((t) => store.schema.tables[t].stored).map((t) => [t, store.rows(t)]));
    try {
      const result = await store.apply(commands);
      opened.signature = storeSignature(config.dataDir);
      opened.checks = null;
      return { status: 200, answer: { ok: true, tables: result.tables, files: result.files, changes: rowChanges(store, before, result.tables) } };
    } catch (error) {
      if (error instanceof StoreError) return { status: 422, answer: { ok: false, error: error.message, problems: error.problems } };
      throw error;
    }
  });
}

// ---------- Routing ----------

/**
 * Handles a request under /api. Returns false when the path is not an API path, so the caller can serve something
 * else. `pathname` is the full path, such as /api/spec.
 */
export async function handleApi(root: string, req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  if (pathname === '/api/spec') {
    if (req.method !== 'GET') return (send(res, 405, { error: 'Method not allowed' }), true);
    try {
      send(res, 200, await specData(root), { 'cache-control': 'no-store' });
    } catch (error) {
      send(res, 500, { error: storeMessage(error) });
    }
    return true;
  }
  if (pathname === '/api/write') {
    if (req.method !== 'POST') return (send(res, 405, { error: 'Method not allowed' }), true);
    if (crossSite(req)) return (send(res, 403, { error: 'Writes come only from this server\'s own pages.' }), true);
    if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      return (send(res, 415, { error: 'A write is sent as application/json.' }), true);
    }
    let body: unknown;
    try {
      body = JSON.parse(await readBody(req, WRITE_BODY_LIMIT));
    } catch (error) {
      if (error instanceof BodyTooLarge) return (send(res, 413, { error: `A write holds at most ${WRITE_BODY_LIMIT} bytes.` }), true);
      return (send(res, 400, { error: 'The body is not JSON.' }), true);
    }
    const problem = writeRequestProblem(body);
    if (problem) return (send(res, 400, { error: problem }), true);
    try {
      const { status, answer } = await write(root, (body as WriteRequest).commands);
      send(res, status, answer, { 'cache-control': 'no-store' });
    } catch (error) {
      send(res, 500, { error: storeMessage(error) });
    }
    return true;
  }
  if (pathname === '/api/reference') {
    if (req.method !== 'GET') return (send(res, 405, { error: 'Method not allowed' }), true);
    try {
      send(res, 200, await buildReference(loadConfig(root).root));
    } catch (error) {
      send(res, 500, { error: storeMessage(error) });
    }
    return true;
  }
  if (pathname === '/api/history') {
    if (req.method !== 'GET') return (send(res, 405, { error: 'Method not allowed' }), true);
    const query = new URL(req.url ?? '/', 'http://localhost').searchParams;
    const id = (query.get('id') ?? '').trim();
    const skip = Number(query.get('skip') ?? '0');
    if (!id) return (send(res, 400, { error: 'Give a record ID: /api/history?id=<ID>.' }), true);
    if (!Number.isInteger(skip) || skip < 0) return (send(res, 400, { error: 'skip is a whole number.' }), true);
    try {
      const config = loadConfig(root);
      const schema = await withStore(config.root, async (opened) => ({ schema: opened.store.schema, kind: opened.store.record(id)?.kind }));
      const answer = await recordHistory(config.root, config.dataDir, schema.schema, id, schema.kind, skip);
      send(res, answer.state === 'no-record' ? 404 : 200, answer, { 'cache-control': 'no-store' });
    } catch (error) {
      send(res, 500, { error: storeMessage(error) });
    }
    return true;
  }
  return false;
}

/** The folders whose changes should make open pages reload, and the event each sends: the product's data and Lathe's (its checks). */
export function watchTargets(root: string): { dir: string; event: 'spec:changed' }[] {
  const config = loadConfig(root);
  return [...new Set([config.dataDir, LATHE_DATA_DIR])].map((dir) => ({ dir, event: 'spec:changed' as const }));
}
