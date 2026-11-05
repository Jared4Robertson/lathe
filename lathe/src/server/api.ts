// Lathe's HTTP API, shared by `lathe serve`, the desktop shell and the app's Vite dev server. Its shapes are in
// contract.ts:
//   POST /api/<aggregate>/<command>   the command's input -> WriteAnswer: one aggregate command, such as /api/use-case/add-flow-step
//   GET  /api/<slice>/<query>?<field>=<value>   the query's answer: one read, such as /api/use-case/get-use-case?id=<ID>; the
//        Record changes read (list-record-changes) is given the product's rows at the commit its `since` names, from git
//   POST /api/snapshot            { product_id } -> { snapshot }: keeps the product's rows as a chat's turn begins
//   POST /api/turn-changes        { snapshot } -> RecordChange[]: the records changed since the snapshot, each with its fields, parts and links
//   POST /api/undo                { snapshot, order } -> WriteAnswer: rolls the product back to the snapshot through the aggregates' own
//        commands (undo.ts), 422 with every reason when something since depends on what the turn made
//   GET  /api/history?id=<ID>     HistoryAnswer: the commits that changed the record's rows (&skip=<n> for older ones)
//   GET  /api/reference           the workspace's own product's Reference (reference.ts): kinds, tables, relations, folders, checks
//
// Every write (each POST) is refused with 403 when it comes from another site's page or from another device: a server
// opened to the network lets other devices read, and only this machine write (access.ts, LA-PLT-UC23-R05).
//
// The root is a workspace: its own product, and each other product its lathe.config.json lists under products, each
// read from and written to its own folder. The store of each product root is opened once and kept (on globalThis, so
// it outlives a reload of this module in the dev server). When a data file changes, by a command or by anything else
// (an editor, git, an Agent), the store reads only the changed files' tables again, and the server announces which
// tables and read models changed (Data files changed, LA-PLT-EV06), so a page reads again only what changed. The check
// rows and coverage run in the background on the data built whole, a burst of changes making one run, once the reads
// the change sets off have answered, and are announced when they are ready (LA-PLT-UC03-R03, R04).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig, productClash, workspaceProducts, type LatheConfig } from '../config.ts';
import { buildReference, readWorkspace } from '../index.ts';
import type { Row } from '../platform/data/rows.ts';
import type { SchemaDescription } from '../platform/data/schema.ts';
import { formatProblem, StoreError } from '../platform/data/problems.ts';
import { LATHE_DATA_DIR, openStore, type Reloaded, type Store } from '../platform/data/store.ts';
import type { ReadRefusal, WriteAnswer } from './contract.ts';
import type { DataChange } from './events.ts';
import { baseline, parseSince } from './baseline.ts';
import { ALL_COMMANDS, ALL_QUERIES } from '../commands.ts';
import { flagValue, InputError, type AnyCommand, type AnyQuery } from '../platform/commands/definition.ts';
import { answerQuery, runCommand, runConditionally, runQuery } from '../platform/commands/run.ts';
import { recordChanges } from '../changes.ts';
import { planUndo, UndoRefusal } from './undo.ts';
import type { CheckRun, ReadView } from '../platform/data/rules.ts';
import { recordHistory } from './history.ts';
import { ACCESS_HEADER, READ_ONLY } from './access.ts';

/** The most a command's body may hold. */
export const WRITE_BODY_LIMIT = 1024 * 1024;

interface Opened {
  config: LatheConfig;
  store: Store;
  /** Why the data is refused, as a load from scratch would refuse it, until a change to the files is built whole; else null. */
  refusal: StoreError | null;
  /** The checks' problems, coverage and chains, of the data built whole last: answered from until a newer run is ready. */
  run: CheckRun | null;
  /** The checks' run in progress, and whether the data changed again since it started. */
  checking: Promise<void> | null;
  again: boolean;
  /** The timer that starts the next run once a burst of changes is over and the requests have answered. */
  timer: NodeJS.Timeout | undefined;
  /** When the first change the next run waits for was made, or null when no run waits. */
  due: number | null;
  /** Requests on this root run one after another, so a write never races a reload. */
  queue: Promise<unknown>;
  /** The requests queued or running on this root: the checks wait until there are none. */
  pending: number;
}

const STORES_KEY = Symbol.for('lathe.server.stores');
const stores: Map<string, Promise<Opened>> = ((globalThis as Record<symbol, unknown>)[STORES_KEY] as Map<string, Promise<Opened>> | undefined) ??
  ((globalThis as Record<symbol, unknown>)[STORES_KEY] = new Map<string, Promise<Opened>>());

/** Who hears the data's changes, by the product root they show (kept on globalThis, beside the stores). */
const LISTENERS_KEY = Symbol.for('lathe.server.listeners');
const listeners: Map<string, Set<(change: DataChange) => void>> = ((globalThis as Record<symbol, unknown>)[LISTENERS_KEY] as Map<string, Set<(change: DataChange) => void>> | undefined) ??
  ((globalThis as Record<symbol, unknown>)[LISTENERS_KEY] = new Map<string, Set<(change: DataChange) => void>>());

/** How long the checks wait after a change for the next one, so a burst of changes (a git pull, an Agent's writes) makes one run. */
export const CHECKS_DELAY_MS = 150;

/**
 * The longest the checks wait for the server to be quiet after a change. The run holds the server's thread for most of
 * its time, so it waits until the reads the change sets off (a page reading again what changed) have answered; but a
 * stream of requests never puts it off for longer than this.
 */
export const CHECKS_MAX_WAIT_MS = 1000;

/**
 * Hears every change to the data of the products the workspace at root shows (Data files changed, LA-PLT-EV06): the
 * tables and read models a reload or a write changed, then the checks' read models once their run is ready. Returns
 * how to stop hearing them.
 */
export function onDataChange(root: string, listener: (change: DataChange) => void): () => void {
  const roots = workspaceProducts(root).map((config) => config.root);
  for (const r of roots) {
    if (!listeners.has(r)) listeners.set(r, new Set());
    listeners.get(r)!.add(listener);
  }
  return () => { for (const r of roots) listeners.get(r)?.delete(listener); };
}

// Tells every listener of the product root what changed.
function announce(root: string, change: DataChange) {
  for (const listener of listeners.get(root) ?? []) listener(change);
}

/** The read models whose queries read the checks' run: they change when a run is ready. */
const CHECKED_READ_MODELS = [...new Set(ALL_QUERIES.filter((q) => q.checked).map((q) => q.slice.name))].sort();

// The read models whose answers the change to these tables can change: each query's projection that read one of them,
// or that has not run on this store yet. The checks' read models change with their run, announced on its own.
function touchedReadModels(store: Store, tables: readonly string[]): string[] {
  const changed = new Set(tables);
  return [...new Set(ALL_QUERIES.filter((q) => !q.checked && store.readerTouched(q.reader, changed)).map((q) => q.slice.name))].sort();
}

// The store of a product root, opened once and kept; its checks start at once.
function openedOf(root: string): Promise<Opened> {
  let pending = stores.get(root);
  if (!pending) {
    pending = (async () => {
      const config = loadConfig(root);
      const opened: Opened = { config, store: await openStore(root), refusal: null, run: null, checking: null, again: false, timer: undefined, due: null, queue: Promise.resolve(), pending: 0 };
      startChecks(opened);
      return opened;
    })();
    stores.set(root, pending);
    pending.catch(() => stores.delete(root));
  }
  return pending;
}

// Reads the changed data files again, announces what changed and starts the checks after it. While the data is
// refused, a change is built whole at once before the refusal is lifted, so a refused state never shows as served.
async function refresh(opened: Opened): Promise<void> {
  const { store, config } = opened;
  let reloaded: Reloaded;
  try {
    reloaded = await store.reload();
    if (!reloaded.files.length) return;
    // While the data is refused, changed files lift the refusal only once their whole build passes.
    if (opened.refusal && !(await store.whole(async () => true))) return;
  } catch (error) {
    if (!(error instanceof StoreError)) throw error;
    // A refusal is announced once, not again for each request that meets it.
    const known = opened.refusal?.message === error.message;
    opened.refusal = error;
    if (!known) announce(config.root, { tables: [], readModels: null });
    return;
  }
  const wasRefused = opened.refusal !== null;
  if (!reloaded.tables.length && !wasRefused) return;
  opened.refusal = null;
  announce(config.root, { tables: reloaded.tables, readModels: reloaded.full || wasRefused ? null : touchedReadModels(store, reloaded.tables) });
  scheduleChecks(opened);
}

// Starts the checks once the changes stop coming for a moment and no request waits on the store.
function scheduleChecks(opened: Opened) {
  opened.due ??= performance.now();
  armChecks(opened);
}

// Sets the checks' timer for the store's state: CHECKS_DELAY_MS once no request is queued or running, or at once when
// the run has waited CHECKS_MAX_WAIT_MS since the change.
function armChecks(opened: Opened) {
  if (opened.due === null) return;
  if (performance.now() - opened.due >= CHECKS_MAX_WAIT_MS) {
    opened.timer ??= setTimeout(() => startChecks(opened), 0);
  } else {
    clearTimeout(opened.timer);
    opened.timer = opened.pending ? undefined : setTimeout(() => startChecks(opened), CHECKS_DELAY_MS);
  }
  opened.timer?.unref?.();
}

// Runs the checks on the data built whole, again while the data changed during a run, and announces each run that is
// of the current data. A refusal of the whole build is the data's refusal.
function startChecks(opened: Opened) {
  clearTimeout(opened.timer);
  opened.timer = undefined;
  opened.due = null;
  if (opened.checking) {
    opened.again = true;
    return;
  }
  opened.checking = (async () => {
    do {
      opened.again = false;
      try {
        const built = await opened.store.whole((data) => checksOf(data, opened.config));
        if (!built) continue;
        opened.run = built.value;
        announce(opened.config.root, { tables: [], readModels: CHECKED_READ_MODELS });
      } catch (error) {
        if (!(error instanceof StoreError)) throw error;
        const known = opened.refusal?.message === error.message;
        opened.refusal = error;
        if (!known) announce(opened.config.root, { tables: [], readModels: null });
      }
    } while (opened.again);
  })().finally(() => { opened.checking = null; });
  opened.checking.catch(() => undefined);
}

// Runs a task on the root's opened store, after every task before it, reading the data files again first when they
// changed under it. Refused data refuses the task. The checks wait while it is queued or running.
async function withStore<T>(root: string, task: (opened: Opened) => Promise<T>): Promise<T> {
  const opened = await openedOf(root);
  opened.pending++;
  armChecks(opened);
  const run = opened.queue.then(async () => {
    await refresh(opened);
    if (opened.refusal) throw opened.refusal;
    return task(opened);
  }).finally(() => {
    opened.pending--;
    armChecks(opened);
  });
  opened.queue = run.catch(() => undefined);
  return run;
}

/**
 * Reads the data files of the products under root again now, as a watcher does when one changes: only the changed
 * files' tables of each product whose store is open (one not opened yet reads every file when it opens), and
 * announces what changed. A refusal is announced, not thrown.
 */
export async function dataFilesChanged(root: string): Promise<void> {
  const open = workspaceProducts(root).filter((config) => stores.has(config.root));
  await Promise.all(open.map((config) => withStore(config.root, async () => undefined).catch(() => undefined)));
}

/**
 * Closes the stores this process opened, or those of a workspace's products (for tests and a server shutting down),
 * each once the request it is serving (a load, a reload or a write) and its checks have finished.
 */
export async function closeStores(root?: string): Promise<void> {
  const roots = root ? workspaceProducts(root).map((config) => config.root) : [...stores.keys()];
  const all = roots.flatMap((r) => { const s = stores.get(r); stores.delete(r); return s ? [s] : []; });
  for (const pending of all) {
    try {
      const opened = await pending;
      clearTimeout(opened.timer);
      await opened.queue;
      await opened.checking?.catch(() => undefined);
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

// The checks' run on the data built whole: every check row's problems, coverage and chains.
async function checksOf(data: Store, config: LatheConfig): Promise<CheckRun> {
  try {
    const workspace = await readWorkspace(data, config);
    return { problems: workspace.problems, coverage: workspace.coverage, chains: workspace.chains };
  } catch (error) {
    return { problems: [{ severity: 'error', check: 'engine', record: null, message: `The checks could not run: ${message(error)}` }], coverage: [], chains: [] };
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

// ---------- Writing ----------

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

/** The socket addresses of this machine's own loopback: the only ones a write is taken from. */
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Whether a socket's remote address is this machine. A server opened to the network serves other devices too, and
 * the network has no sign-in, so only this machine writes (LA-PLT-UC23-R05).
 */
export function fromThisMachine(address: string | undefined): boolean {
  return address !== undefined && LOOPBACK.has(address);
}

/** Why a write is refused before it is read, or null when it may go on: another site's page, or another device. */
function writeRefusal(req: IncomingMessage): string | null {
  if (crossSite(req)) return 'Writes come only from this server\'s own pages.';
  if (!fromThisMachine(req.socket.remoteAddress)) return 'Changes come only from the machine Lathe runs on; other devices on the network can read.';
  return null;
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

/**
 * The product root a command or a read goes to: the one whose store holds the first record its input names, or whose
 * product's ID starts it. One naming none of them, such as a new product's, goes to the workspace's own folder.
 */
async function productRoot(products: LatheConfig[], ids: string[]): Promise<string> {
  if (products.length === 1) return products[0].root;
  const known = await Promise.all(products.map((config) => withStore(config.root, async (opened) => ({
    root: config.root,
    has: (id: string) => opened.store.record(id) !== undefined,
    products: opened.store.rows('product').map((p) => String(p.id)),
  }))));
  const ownerOf = (id: string) =>
    known.find((k) => k.has(id))?.root ?? known.find((k) => k.products.some((p) => id === p || id.startsWith(`${p}-`)))?.root;
  return ids.map(ownerOf).find((r) => r !== undefined) ?? products[0].root;
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
  const root = await productRoot(products, inputIds(input));
  const config = products.find((p) => p.root === root)!;
  // A command that reads the checks' run is given the product's run over its data as it is now.
  const checked = definition.checked ? await currentRun(config) : undefined;
  return withStore(config.root, async (opened) => {
    try {
      const committed = await runCommand(opened.store, definition, input, checked);
      if (committed.tables.length) {
        announce(config.root, { tables: committed.tables, readModels: touchedReadModels(opened.store, committed.tables) });
        scheduleChecks(opened);
      }
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

/** Each aggregate query's route, GET /api/<aggregate>/<query>, with the one query it reads. A route is a command's or a query's, never both. */
const QUERY_ROUTES = new Map(ALL_QUERIES.map((definition) => {
  if (COMMAND_ROUTES.has(definition.route)) throw new Error(`${definition.route} is both a command's route and a query's`);
  return [definition.route, definition];
}));

/** Every product's store of the workspace read as one: their schemas joined, each table's rows from every store; refused when two folders hold one product. */
async function workspaceView(products: LatheConfig[]): Promise<ReadView> {
  const read = await Promise.all(products.map((config) => withStore(config.root, async (opened) => ({ root: config.root, schema: opened.store.schema, tables: tablesOf(opened.store) }))));
  // One product in two folders is refused: a product's records live in its own folder only.
  const clash = productClash(products[0].root, read.map((r) => ({ root: r.root, ids: (r.tables.product ?? []).map((p) => String(p.id)) })));
  if (clash) throw new Error(clash);
  const rows = (table: string) => read.flatMap((r) => r.tables[table] ?? []);
  const schema = joinSchemas(read.map((r) => r.schema));
  let byId: Map<string, { kind: string; row: Row }> | null = null;
  return {
    schema,
    rows,
    record: (id) => {
      byId ??= new Map(Object.keys(schema.kinds).flatMap((kind) => rows(kind).map((row) => [String(row.id), { kind, row }] as const)));
      return byId.get(id);
    },
  };
}

/**
 * The product's checks' run over its data as it is now: a run that is due, or never made, is started and waited for.
 * Over refused data there is none, and the command's own task is then refused with the data's reasons (withStore).
 */
async function currentRun(config: LatheConfig): Promise<CheckRun> {
  const opened = await openedOf(config.root);
  if (opened.due !== null || !opened.run) startChecks(opened);
  while (opened.checking) await opened.checking;
  return opened.run ?? { problems: [], coverage: [], chains: [] };
}

/** Every product's checks' run, each the one the server keeps for its data, joined. */
async function workspaceRun(products: LatheConfig[]): Promise<CheckRun> {
  const runs = await Promise.all(products.map(async (config) => {
    // The last run is answered at once; only data never checked yet waits for its first run, outside the queue.
    const { run, first } = await withStore(config.root, async (opened) => {
      if (!opened.run && !opened.checking) startChecks(opened);
      return { run: opened.run, first: { done: opened.checking } };
    });
    if (run) return run;
    await first.done;
    const opened = await openedOf(config.root);
    if (opened.refusal) throw opened.refusal;
    return opened.run ?? { problems: [], coverage: [], chains: [] };
  }));
  return { problems: runs.flatMap((r) => r.problems), coverage: runs.flatMap((r) => r.coverage), chains: runs.flatMap((r) => r.chains) };
}

/** The query's answer over the data for the query string: 200, 400 for an input of another shape, 422 when it refuses. */
function answerRead(view: ReadView, definition: AnyQuery, params: URLSearchParams): { status: number; answer: unknown } {
  try {
    const args: Record<string, unknown> = {};
    for (const name of new Set(params.keys())) {
      const field = definition.input[name];
      args[name] = field ? flagValue(view.schema, name, field, params.getAll(name)) : params.get(name);
    }
    return { status: 200, answer: runQuery(view, definition, args) };
  } catch (error) {
    if (error instanceof InputError) return { status: 400, answer: { error: error.message } satisfies ReadRefusal };
    if (error instanceof StoreError) return { status: 422, answer: { error: error.message, problems: error.problems } satisfies ReadRefusal };
    throw error;
  }
}

/**
 * Reads one aggregate query on the product its input names: 200 with its answer, 400 when the input is not of its
 * shape, 422 when it refuses (a record that is missing or of another kind). The input is the query string, each field
 * read as the CLI reads its flag: a list from the field given once per item, a number or true or false by its column.
 * A query that reads the checks' run reads every product's data with every product's run, the server's kept ones, as
 * the space's problems and coverage take in the workspace's and leave out the other products'.
 */
async function runRead(workspace: string, definition: AnyQuery, params: URLSearchParams): Promise<{ status: number; answer: unknown }> {
  const products = workspaceProducts(workspace);
  if (definition.checked) {
    const [view, checked] = await Promise.all([workspaceView(products), workspaceRun(products)]);
    return answerRead({ ...view, checked }, definition, params);
  }
  const values = [...new Set(params.keys())].flatMap((name) => params.getAll(name));
  // A read that names no record, such as the list of the products, is of the whole workspace: every product's store.
  if (values.length === 0 && products.length > 1) return { status: 200, answer: answerQuery(await workspaceView(products), definition, {}) };
  const root = await productRoot(products, values);
  if (definition.baseline) return readAtBaseline(products.find((p) => p.root === root)!, definition, params);
  return withStore(root, async (opened) => answerRead(opened.store, definition, params));
}

/**
 * A read of the data at a baseline (the Record changes read): the product's store with its rows at the commit the
 * input's `since` names (the last commit, where the branch left the default branch, or a hash), read from git; 400 for
 * any other `since`.
 */
async function readAtBaseline(config: LatheConfig, definition: AnyQuery, params: URLSearchParams): Promise<{ status: number; answer: unknown }> {
  const since = parseSince(params.get('since'));
  if (!since) return { status: 400, answer: { error: 'since is commit, branch or a commit hash.' } satisfies ReadRefusal };
  return withStore(config.root, async (opened) => {
    const at = await baseline(config.root, config.dataDir, opened.store.schema, since);
    const { store } = opened;
    return answerRead({ schema: store.schema, rows: (table) => store.rows(table), record: (id) => store.record(id), baseline: at }, definition, params);
  });
}

// ---------- Undoing a turn ----------

/** The rows of a product kept when a chat's turn began, by the token the page was given; the oldest go past this many. */
const SNAPSHOT_LIMIT = 24;
const SNAPSHOTS_KEY = Symbol.for('lathe.server.snapshots');
const snapshots: Map<string, { root: string; tables: Record<string, Row[]> }> = ((globalThis as Record<symbol, unknown>)[SNAPSHOTS_KEY] as Map<string, { root: string; tables: Record<string, Row[]> }> | undefined) ??
  ((globalThis as Record<symbol, unknown>)[SNAPSHOTS_KEY] = new Map<string, { root: string; tables: Record<string, Row[]> }>());
let snapshotCount = 0;

/** Keeps the rows of the product now, for the undo of the turn that begins: its token. */
async function takeSnapshot(workspace: string, productId: string): Promise<string> {
  const products = workspaceProducts(workspace);
  const root = await productRoot(products, [productId]);
  const tables = await withStore(root, async (opened) => tablesOf(opened.store));
  const token = `snapshot-${Date.now().toString(36)}-${++snapshotCount}`;
  snapshots.set(token, { root, tables });
  for (const old of [...snapshots.keys()].slice(0, Math.max(0, snapshots.size - SNAPSHOT_LIMIT))) snapshots.delete(old);
  return token;
}

/** Rolls the product back to a snapshot through the aggregates' own commands (undo.ts): 200 with the rows changed, 422 with every reason when it cannot. */
async function runUndo(workspace: string, token: string, order: string[]): Promise<{ status: number; answer: WriteAnswer | { error: string } }> {
  const kept = snapshots.get(token);
  if (!kept) return { status: 422, answer: { ok: false, error: 'That turn can no longer be undone: the server no longer holds the data from before it.', problems: [{ rule: 'undo', message: 'the snapshot from before the turn is gone' }] } };
  const config = workspaceProducts(workspace).find((p) => p.root === kept.root);
  if (!config) return { status: 404, answer: { error: 'That product is no longer in the workspace.' } };
  return withStore(config.root, async (opened) => {
    try {
      const steps = planUndo(opened.store.schema, kept.tables, tablesOf(opened.store), order);
      const committed = await runConditionally(opened.store, steps);
      if (committed.tables.length) {
        announce(config.root, { tables: committed.tables, readModels: touchedReadModels(opened.store, committed.tables) });
        scheduleChecks(opened);
      }
      snapshots.delete(token);
      return { status: 200, answer: { ok: true, tables: committed.tables, files: committed.files, changes: committed.changes } };
    } catch (error) {
      if (error instanceof UndoRefusal) return { status: 422, answer: { ok: false, error: error.message, problems: error.reasons.map((message) => ({ rule: 'undo', message })) } };
      if (error instanceof InputError) return { status: 422, answer: { ok: false, error: error.message, problems: [{ rule: 'undo', message: error.message }] } };
      if (error instanceof StoreError) return { status: 422, answer: { ok: false, error: error.message, problems: error.problems } };
      throw error;
    }
  });
}

// ---------- Routing ----------

/**
 * Handles a request under /api. Returns false when the path is not an API path, so the caller can serve something
 * else. `pathname` is the full path, such as /api/use-case/get-use-case.
 */
export async function handleApi(root: string, req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  // Another device reads only: every answer tells its app so (access.ts).
  if (!fromThisMachine(req.socket.remoteAddress)) res.setHeader(ACCESS_HEADER, READ_ONLY);
  const routed = COMMAND_ROUTES.get(pathname);
  if (routed) {
    if (req.method !== routed.method) return (send(res, 405, { error: 'Method not allowed' }), true);
    const refused = writeRefusal(req);
    if (refused) return (send(res, 403, { error: refused }), true);
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
  const read = QUERY_ROUTES.get(pathname);
  if (read) {
    if (req.method !== read.method) return (send(res, 405, { error: 'Method not allowed' }), true);
    try {
      const { status, answer } = await runRead(root, read, new URL(req.url ?? '/', 'http://localhost').searchParams);
      send(res, status, answer, { 'cache-control': 'no-store' });
    } catch (error) {
      send(res, 500, { error: storeMessage(error) });
    }
    return true;
  }
  if (pathname === '/api/snapshot' || pathname === '/api/undo' || pathname === '/api/turn-changes') {
    if (req.method !== 'POST') return (send(res, 405, { error: 'Method not allowed' }), true);
    const refused = writeRefusal(req);
    if (refused) return (send(res, 403, { error: refused }), true);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(await readBody(req, WRITE_BODY_LIMIT)) as Record<string, unknown>;
      if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new Error('not an object');
    } catch {
      return (send(res, 400, { error: 'The body is a JSON object.' }), true);
    }
    try {
      if (pathname === '/api/snapshot') {
        if (typeof body.product_id !== 'string') return (send(res, 400, { error: 'Give the product as product_id.' }), true);
        send(res, 200, { snapshot: await takeSnapshot(root, body.product_id) }, { 'cache-control': 'no-store' });
      } else if (pathname === '/api/turn-changes') {
        const kept = typeof body.snapshot === 'string' ? snapshots.get(body.snapshot) : undefined;
        if (!kept) return (send(res, 404, { error: 'The data from before that turn is no longer kept.' }), true);
        const changes = await withStore(kept.root, async (opened) => recordChanges(opened.store.schema, kept.tables, tablesOf(opened.store)));
        send(res, 200, changes, { 'cache-control': 'no-store' });
      } else {
        if (typeof body.snapshot !== 'string' || !Array.isArray(body.order) || !body.order.every((id) => typeof id === 'string')) {
          return (send(res, 400, { error: 'Give the snapshot as snapshot and the IDs the turn touched, in order, as order.' }), true);
        }
        const { status, answer } = await runUndo(root, body.snapshot, body.order as string[]);
        send(res, status, answer, { 'cache-control': 'no-store' });
      }
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
 * The folders whose changes the server reads again (dataFilesChanged): the data folder of every product the workspace
 * shows, and Lathe's (its checks).
 */
export function watchTargets(root: string): string[] {
  const dirs = workspaceProducts(root).map((config) => config.dataDir);
  return [...new Set([...dirs, LATHE_DATA_DIR])];
}
