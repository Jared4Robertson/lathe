// Lathe's HTTP API, shared by `lathe serve`, the desktop shell and the app's Vite dev server. Its shapes are in
// contract.ts:
//   GET  /api/spec                SpecData: the schema, each product folder's rows, where each record with no owner sits, and the checks' problems, the recorded exceptions and coverage
//   POST /api/write               { commands } -> WriteAnswer: one transaction through the command layer of the product the commands name
//   POST /api/<aggregate>/<command>   the command's input -> WriteAnswer: one aggregate command, such as /api/use-case/add-flow-step
//   GET  /api/history?id=<ID>     HistoryAnswer: the commits that changed the record's rows (&skip=<n> for older ones)
//   GET  /api/baseline?product=<ID>&since=<commit|branch|hash>   BaselineAnswer: the product's rows at a commit, for the record diff (../changes.ts)
//   GET  /api/reference           the workspace's own product's Reference (reference.ts): kinds, tables, relations, folders, checks
//
// The root is a workspace: its own product, and each other product its lathe.config.json lists under products, each
// read from and written to its own folder. The store of each product root is opened once and kept (on globalThis, so
// it outlives a reload of this module in the dev server). Before each request the data folder's files are compared
// with what the store last read or wrote; a change made by anything else (an editor, git) opens the store afresh.
import { existsSync, readdirSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { loadConfig, productClash, workspaceProducts, type LatheConfig } from '../config.ts';
import { buildReference, loadWorkspace } from '../index.ts';
import { describeKey, rowKey, type Row } from '../platform/data/rows.ts';
import type { SchemaDescription } from '../platform/data/schema.ts';
import type { Command } from '../platform/data/generic-write.ts';
import { formatProblem, StoreError } from '../platform/data/problems.ts';
import { LATHE_DATA_DIR, openStore, type Store } from '../platform/data/store.ts';
import type { RowChange, SpecData, WriteAnswer, WriteRequest } from './contract.ts';
import { baseline, parseSince } from './baseline.ts';
import { ALL_COMMANDS } from '../commands.ts';
import { InputError, type AnyCommand } from '../platform/commands/definition.ts';
import { runCommand } from '../platform/commands/run.ts';
import { recordHistory } from './history.ts';

/** The most a write's body may hold. */
export const WRITE_BODY_LIMIT = 1024 * 1024;
/** The most commands one write may hold. */
export const WRITE_COMMAND_LIMIT = 500;

interface Opened {
  store: Store;
  /** The data folder's files as the store last read or wrote them. */
  signature: string;
  /** The checks' problems, the recorded exceptions and coverage for this data, once worked out. */
  checks: Promise<Checked> | null;
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
 * Closes the stores this process opened, or those of a workspace's products (for tests and a server shutting down),
 * each once the request it is serving (a load, a reload or a write) has finished.
 */
export async function closeStores(root?: string): Promise<void> {
  const roots = root ? workspaceProducts(root).map((config) => config.root) : [...stores.keys()];
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

type Checked = Pick<SpecData, 'problems' | 'exceptions' | 'coverage' | 'chains'>;

async function checksOf(root: string): Promise<Checked> {
  try {
    const workspace = await loadWorkspace(root);
    return { problems: workspace.problems, exceptions: workspace.exceptions, coverage: workspace.coverage, chains: workspace.chains };
  } catch (error) {
    return { problems: [{ severity: 'error', check: 'engine', record: null, message: `The checks could not run: ${message(error)}` }], exceptions: [], coverage: [], chains: [] };
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

/**
 * The schemas of several products' stores as one: Lathe's tables, kinds and relations once, each product's own kinds
 * and relations added, and the pairs a product adds to one of Lathe's relations joined. A product's own table comes
 * after the tables it points at in the load order, as in its own schema.
 */
export function joinSchemas(schemas: SchemaDescription[]): SchemaDescription {
  const [first, ...rest] = schemas;
  const joined: SchemaDescription = {
    tables: { ...first.tables },
    loadOrder: [...first.loadOrder],
    kinds: { ...first.kinds },
    relations: Object.fromEntries(Object.entries(first.relations).map(([name, r]) => [name, { ...r, pairs: [...r.pairs] }])),
    supertypes: Object.fromEntries(Object.entries(first.supertypes).map(([name, members]) => [name, [...members]])),
    stages: first.stages,
  };
  for (const schema of rest) {
    for (const [name, table] of Object.entries(schema.tables)) joined.tables[name] ??= table;
    for (const name of schema.loadOrder) if (!joined.loadOrder.includes(name)) joined.loadOrder.push(name);
    for (const [name, kind] of Object.entries(schema.kinds)) joined.kinds[name] ??= kind;
    for (const [name, relation] of Object.entries(schema.relations)) {
      const known = joined.relations[name];
      if (!known) { joined.relations[name] = { ...relation, pairs: [...relation.pairs] }; continue; }
      for (const pair of relation.pairs) if (!known.pairs.some((p) => p.source === pair.source && p.target === pair.target)) known.pairs.push(pair);
    }
    for (const [name, members] of Object.entries(schema.supertypes)) {
      const known = (joined.supertypes[name] ??= []);
      for (const member of members) if (!known.includes(member)) known.push(member);
    }
  }
  return joined;
}

/** A folder as the workspace names it: from its root, written with /. */
const fromWorkspace = (workspace: string, dir: string) => path.relative(workspace, dir).split(path.sep).join('/') || '.';

/** Every product the workspace shows, each from its own store, as one SpecData. */
async function specData(root: string): Promise<SpecData> {
  const products = workspaceProducts(root);
  const read = await Promise.all(products.map((config) => withStore(config.root, async (opened) => {
    opened.checks ??= checksOf(config.root);
    return {
      root: config.root,
      schema: opened.store.schema,
      source: { dataDir: fromWorkspace(products[0].root, config.dataDir), tables: tablesOf(opened.store) },
      placements: await opened.store.placements(),
      checked: await opened.checks,
    };
  })));
  const clash = productClash(products[0].root, read.map((r) => ({ root: r.root, ids: (r.source.tables.product ?? []).map((p) => String(p.id)) })));
  if (clash) throw new Error(clash);
  return {
    schema: joinSchemas(read.map((r) => r.schema)),
    sources: read.map((r) => r.source),
    placements: Object.assign({}, ...read.map((r) => r.placements)),
    problems: read.flatMap((r) => r.checked.problems),
    exceptions: read.flatMap((r) => r.checked.exceptions),
    coverage: read.flatMap((r) => r.checked.coverage),
    chains: read.flatMap((r) => r.checked.chains),
  };
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

/** The IDs and key values a command names, the record it changes first: what tells whose product it is. */
function namedIds(command: Command): string[] {
  const keyValues = (key: string | Record<string, unknown>) => (typeof key === 'string' ? [key] : Object.values(key).filter((v): v is string => typeof v === 'string'));
  switch (command.op) {
    case 'add': {
      const { row } = command;
      const ids = Object.entries(row).filter(([column]) => column === 'id' || column.endsWith('_id')).map(([, v]) => v);
      return [row.id, ...ids].filter((v): v is string => typeof v === 'string');
    }
    case 'set':
    case 'remove':
      return keyValues(command.key);
    case 'move':
      return [command.id, command.parent];
    case 'link':
    case 'unlink':
      return [command.source, command.target];
  }
}

/**
 * The product root a write goes to: the one whose store holds a record, or a product whose ID starts one, the
 * commands name. A write naming none of them, such as a new product's, goes to the workspace's own folder; one naming
 * records of two products is refused.
 */
async function writeRoot(products: LatheConfig[], named: string[][]): Promise<{ root: string } | { refused: string }> {
  const known = await Promise.all(products.map((config) => withStore(config.root, async (opened) => ({
    root: config.root,
    has: (id: string) => opened.store.record(id) !== undefined,
    products: opened.store.rows('product').map((p) => String(p.id)),
  }))));
  const ownerOf = (id: string) =>
    known.find((k) => k.has(id))?.root ?? known.find((k) => k.products.some((p) => id === p || id.startsWith(`${p}-`)))?.root;
  const roots = new Set<string>();
  for (const ids of named) {
    const root = ids.map(ownerOf).find((r) => r !== undefined);
    if (root) roots.add(root);
  }
  if (roots.size > 1) {
    const folders = [...roots].map((r) => (r === products[0].root ? "the workspace's own folder" : fromWorkspace(products[0].root, r))).join(' and ');
    return { refused: `A write changes one product: these commands name records in ${folders}. Send each product's commands as a write of its own.` };
  }
  return { root: [...roots][0] ?? products[0].root };
}

async function write(workspace: string, commands: Command[]): Promise<{ status: number; answer: WriteAnswer }> {
  const products = workspaceProducts(workspace);
  const routed = products.length === 1 ? { root: products[0].root } : await writeRoot(products, commands.map(namedIds));
  if ('refused' in routed) return { status: 422, answer: { ok: false, error: routed.refused, problems: [] } };
  const config = products.find((p) => p.root === routed.root)!;
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

/** The IDs a command's input names, its own record's first: what tells whose product it is. */
function inputIds(input: Record<string, unknown>): string[] {
  const values = Object.entries(input)
    .filter(([name]) => name === 'id' || name.endsWith('_id'))
    .map(([, value]) => value);
  return values.filter((v): v is string => typeof v === 'string');
}

/** Runs one aggregate command on the product its input names: 200 with what it changed, 400 or 422 on refusal. */
async function runRoute(workspace: string, definition: AnyCommand, input: Record<string, unknown>): Promise<{ status: number; answer: WriteAnswer | { error: string } }> {
  const products = workspaceProducts(workspace);
  const routed = products.length === 1 ? { root: products[0].root } : await writeRoot(products, [inputIds(input)]);
  if ('refused' in routed) return { status: 422, answer: { ok: false, error: routed.refused, problems: [] } };
  const config = products.find((p) => p.root === routed.root)!;
  return withStore(config.root, async (opened) => {
    try {
      const committed = await runCommand(opened.store, definition, input);
      opened.signature = storeSignature(config.dataDir);
      opened.checks = null;
      return { status: 200, answer: { ok: true, tables: committed.tables, files: committed.files, changes: committed.changes } };
    } catch (error) {
      if (error instanceof InputError) return { status: 400, answer: { error: error.message } };
      if (error instanceof StoreError) return { status: 422, answer: { ok: false, error: error.message, problems: error.problems } };
      throw error;
    }
  });
}

/** Each aggregate command's route, POST /api/<aggregate>/<command>, with the one command it runs. */
const COMMAND_ROUTES = new Map(ALL_COMMANDS.map((definition) => [definition.route, definition]));

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
  const routed = COMMAND_ROUTES.get(pathname);
  if (routed) {
    if (req.method !== routed.method) return (send(res, 405, { error: 'Method not allowed' }), true);
    if (crossSite(req)) return (send(res, 403, { error: 'Writes come only from this server\'s own pages.' }), true);
    if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      return (send(res, 415, { error: 'A command is sent as application/json.' }), true);
    }
    let body: unknown;
    try {
      body = JSON.parse(await readBody(req, WRITE_BODY_LIMIT));
    } catch (error) {
      if (error instanceof BodyTooLarge) return (send(res, 413, { error: `A command holds at most ${WRITE_BODY_LIMIT} bytes.` }), true);
      return (send(res, 400, { error: 'The body is not JSON.' }), true);
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return (send(res, 400, { error: `${routed.name} takes a JSON object.` }), true);
    try {
      const { status, answer } = await runRoute(root, routed, body as Record<string, unknown>);
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
  if (pathname === '/api/baseline') {
    if (req.method !== 'GET') return (send(res, 405, { error: 'Method not allowed' }), true);
    const query = new URL(req.url ?? '/', 'http://localhost').searchParams;
    const product = (query.get('product') ?? '').trim();
    const since = parseSince(query.get('since'));
    if (!product) return (send(res, 400, { error: 'Give a product: /api/baseline?product=<ID>&since=commit.' }), true);
    if (!since) return (send(res, 400, { error: 'since is commit, branch or a commit hash.' }), true);
    try {
      // The product's own folder: the first product root whose store holds the product.
      let found: { config: LatheConfig; schema: SchemaDescription } | undefined;
      for (const config of workspaceProducts(root)) {
        found = await withStore(config.root, async (opened) => (opened.store.record(product)?.kind === 'product' ? { config, schema: opened.store.schema } : undefined));
        if (found) break;
      }
      if (!found) return (send(res, 404, { error: `There's no product ${product}.` }), true);
      send(res, 200, await baseline(found.config.root, found.config.dataDir, found.schema, since), { 'cache-control': 'no-store' });
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
      // The record's history is in its own product's folder: the first product whose store holds it.
      const products = workspaceProducts(root);
      let found: { config: LatheConfig; schema: SchemaDescription; kind: string | undefined } | undefined;
      for (const config of products) {
        const seen = await withStore(config.root, async (opened) => ({ config, schema: opened.store.schema, kind: opened.store.record(id)?.kind }));
        found ??= seen;
        if (seen.kind) { found = seen; break; }
      }
      const { config, schema, kind } = found!;
      const answer = await recordHistory(config.root, config.dataDir, schema, id, kind, skip);
      send(res, answer.state === 'no-record' ? 404 : 200, answer, { 'cache-control': 'no-store' });
    } catch (error) {
      send(res, 500, { error: storeMessage(error) });
    }
    return true;
  }
  return false;
}

/**
 * The folders whose changes should make open pages reload, and the event each sends: the data folder of every product
 * the workspace shows, and Lathe's (its checks).
 */
export function watchTargets(root: string): { dir: string; event: 'spec:changed' }[] {
  const dirs = workspaceProducts(root).map((config) => config.dataDir);
  return [...new Set([...dirs, LATHE_DATA_DIR])].map((dir) => ({ dir, event: 'spec:changed' as const }));
}
