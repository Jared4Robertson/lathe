// The store: loads data/*.jsonl into the typed tables, and runs each write as a transaction (transaction.ts). A load
// and a write build their state the same way: in a fresh database, every row inside one transaction, judged by the
// keys and checks, the integrity queries (integrity.ts) and every aggregate's rules (AGGREGATE_RULES); only then does it
// become the current state.
//
// Why a fresh database: DuckDB checks a foreign key as each statement runs, even inside a transaction, so it refuses
// to delete or re-key a row that another row references, even when the same transaction removes that reference
// first. Building the new state afresh, parents before children, keeps every key real and every write atomic.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { AGGREGATE_RULES } from '../../aggregate-rules.ts';
import { productRules } from '../../product/product/rules.ts';
import { sealDatabase } from '../../checking/check/rules.ts';
import { loadConfig, PACKAGE_DIR } from '../../config.ts';
import { attachCached, baseKey, copyDatabase, isValidated, markValidated, productKey, validatedKey, writeCached } from './cache.ts';
import { appendRows, insertRows } from './insert.ts';
import { settleWrite, type Settled } from './journal.ts';
import { integrityQueries, materializeViewsSql, recordScopeColumns, recordScopeSql, storeViewsSql, useCaseGroupsSql, type IntegrityQuery } from './integrity.ts';
import { problemAt, StoreError, type Origin, type StoreProblem } from './problems.ts';
import { productKindSql, type DeclarationProblem } from './product-kinds.ts';
import type { Located } from './references.ts';
import { keysHold, ReadSets, trackedView } from './reads.ts';
import type { AggregateRules, CheckedProblems, ReaderFactory, ReadView } from './rules.ts';
import { describeKey, normalizeRow, rowKey, sortRows, type Row } from './rows.ts';
import { applyMigrations, describeSchema, readMigrations, sqlName, type SchemaDescription } from './schema.ts';
import { commit, DECLARATION_TABLES, Transaction, type Committed, type Tables, type TransactionHost } from './transaction.ts';

export interface StoreOptions {
  /** The data folder, in place of the one lathe.config.json names (default data/ at the root). */
  dataDir?: string;
  /**
   * Lathe's own data folder, loaded beside the product's: the package's data/, which holds Lathe's built-in checks.
   * Its rows are read-only: a write never changes them and never writes them into the product's folder. null loads
   * the product's folder alone.
   */
  latheDataDir?: string | null;
  /**
   * Filled with how long each step of the load took, in milliseconds: reading the files, the schema, copying it, each
   * table's insert, record_scope, each integrity query, each aggregate's rules and the commit (`perf/engine.ts --profile` prints them).
   */
  steps?: Record<string, number>;
}

/** The package's own data folder: Lathe's built-in checks, as data/check.jsonl. */
export const LATHE_DATA_DIR = path.join(PACKAGE_DIR, 'data');

// One DuckDB instance serves every store in the process. Its lathe_base database holds Lathe's migrations: the schema
// cache's file, attached read only, or else applied once and then cached (cache.ts). Each store copies it into
// databases of its own, named uniquely.
interface Engine {
  instance: DuckDBInstance;
  baseSchema: SchemaDescription;
  /** The base schema's cache key, which the keys of products' schemas start with. */
  key: string;
}
let engine: Promise<Engine> | undefined;
const BASE_DB = 'lathe_base';
/** How many integrity queries run at once, each on its own connection to the new data. */
const VALIDATION_CONNECTIONS = 4;
// The schema databases built for products' own kinds and relations, by the SQL that adds them.
const schemaDatabases = new Map<string, Promise<{ schemaDb: string; schema: SchemaDescription }>>();
let databases = 0;
// One empty data database per schema database, copied while nothing waits on it, so a load or write starts filling
// straight away. It holds the schema and the meta-model's rows, never a product's data (LA-PLT-UC01-R04).
const spares = new Map<string, Promise<string>>();
// The work the engine does on no store's behalf (spares being copied, schema databases being built), until it
// settles. closeEngine waits for it: native work still running when a process exits ends it with an engine error.
const background = new Set<Promise<unknown>>();
// The stores opening or open, which closeEngine leaves the engine running for.
let live = 0;

// Whether the process runs one command and exits, as the CLI's commands do: then no load prepares a spare for a load
// that never comes, which only delays the exit.
let oneCommand = false;

/** Tells the engine the process runs one command and exits (the CLI's commands, not serve or mcp). */
export function forOneCommand(): void {
  oneCommand = true;
}

function inBackground<T>(work: Promise<T>): Promise<T> {
  background.add(work);
  const settled = () => background.delete(work);
  work.then(settled, settled);
  return work;
}

/**
 * Waits for the engine's background work, then closes the shared DuckDB instance when no store is opening or open
 * (another server in the process may still use it). The next openStore starts the engine afresh. A process that
 * is about to exit calls it after closing its stores, so no native work outlives the JavaScript that awaits it.
 */
export async function closeEngine(): Promise<void> {
  while (background.size) await Promise.allSettled([...background]);
  if (live > 0 || !engine) return;
  const closing = engine;
  engine = undefined;
  spares.clear();
  schemaDatabases.clear();
  const opened = await closing.catch(() => undefined);
  opened?.instance.closeSync();
}

// Each instance's file work (the schema cache's attaches and writes), and its seal once it is sealed.
interface Files {
  work: Set<Promise<unknown>>;
  sealed?: Promise<void>;
}
const files = new WeakMap<DuckDBInstance, Files>();
const filesOf = (instance: DuckDBInstance): Files => {
  let of = files.get(instance);
  if (!of) files.set(instance, (of = { work: new Set() }));
  return of;
};

// Runs work that reads or writes the schema cache's files while the instance is open to them; on a sealed instance it
// runs nothing and answers undefined (the schema is built afresh instead: the cache is only a shortcut).
function withFiles<T>(instance: DuckDBInstance, work: () => Promise<T>): Promise<T | undefined> {
  const of = filesOf(instance);
  if (of.sealed) return Promise.resolve(undefined);
  const run = work();
  of.work.add(run);
  const done = () => of.work.delete(run);
  run.then(done, done);
  return run;
}

/**
 * Seals the instance (sealDatabase, LA-CHK-INV06) once its file work in progress is done: no file, URL, extension,
 * secret or setting, and none of the process's environment in its settings. The settings are global, so one seal
 * serves every store of the engine until closeEngine. A load seals it before its data's first query runs, so no
 * integrity query and no check, Lathe's or a product's, runs on an open instance; an instance that cannot be sealed
 * refuses every load and write after it.
 */
function seal(instance: DuckDBInstance): Promise<void> {
  const of = filesOf(instance);
  of.sealed ??= (async () => {
    while (of.work.size) await Promise.allSettled([...of.work]);
    const connection = await instance.connect();
    try {
      await sealDatabase(connection);
    } finally {
      connection.closeSync();
    }
  })();
  return of.sealed;
}

function sharedEngine(): Promise<Engine> {
  engine ??= (async () => {
    const instance = await DuckDBInstance.create(':memory:');
    const connection = await instance.connect();
    try {
      const migrations = readMigrations();
      const key = baseKey(migrations);
      const cached = await attachCached(connection, BASE_DB, key);
      if (cached) return { instance, baseSchema: cached, key };
      await connection.run(`ATTACH ':memory:' AS ${BASE_DB}`);
      await connection.run(`USE ${BASE_DB}`);
      await applyMigrations(connection, migrations);
      const baseSchema = await describeSchema(connection);
      await connection.run(storeViewsSql(baseSchema));
      cache(instance, BASE_DB, key, baseSchema);
      return { instance, baseSchema, key };
    } finally {
      connection.closeSync();
    }
  })();
  return engine;
}

// Writes a schema database built afresh to the schema cache, while nothing waits on it; a sealed instance writes nothing.
function cache(instance: DuckDBInstance, schemaDb: string, key: string, schema: SchemaDescription) {
  inBackground(
    withFiles(instance, async () => {
      const writer = await instance.connect();
      try {
        await writeCached(writer, schemaDb, key, schema);
      } finally {
        writer.closeSync();
      }
    }),
  );
}

/** Opens the store of the product repo at root: reads its data files and loads them with every key and check. */
export async function openStore(root: string, options: StoreOptions = {}): Promise<Store> {
  const dataDir = path.resolve(options.dataDir ?? loadConfig(root).dataDir);
  const latheDataDir = options.latheDataDir === undefined ? LATHE_DATA_DIR : options.latheDataDir;
  // Lathe's own folder opened as a product's (Lathe's package itself) is loaded once, as the product's.
  const beside = latheDataDir === null || path.resolve(latheDataDir) === dataDir ? null : path.resolve(latheDataDir);
  live++;
  let store: Store;
  try {
    const { instance, baseSchema } = await sharedEngine();
    store = new Store(instance, await instance.connect(), baseSchema, dataDir, beside, options.steps);
  } catch (error) {
    live--;
    throw error;
  }
  try {
    await store.load();
  } catch (error) {
    await store.close();
    throw error;
  }
  return store;
}

/** What a reload changed: the tables whose rows it read again (every stored table when it loaded afresh). */
export interface Reloaded {
  /** The data files whose size or time changed, by path: read again, or gone. */
  files: string[];
  tables: string[];
  /** Whether it loaded every file afresh: a product's kinds or relations changed, or a file of no table came or went. */
  full: boolean;
}

/** A data folder the store reads: its files, how a problem names it, and whether its rows are Lathe's own. */
interface Folder {
  dir: string;
  display: string;
  builtIn: boolean;
  files: string[];
}

/** The state last built whole in the database, with every key, check, integrity query and rule: what a refused full check goes back to. */
interface Whole {
  tables: Tables;
  signatures: Map<string, string>;
}

/**
 * A product repo's data: the typed tables, kept in step with the data files, and the database built from them. A
 * load and a write build the state whole in the database before it becomes current. A reload of changed files reads
 * only their tables and holds them to the keys and the rules that read them at once; the whole build (the database's
 * checks, the integrity queries and every rule) then runs in the background, through whole().
 */
export class Store {
  readonly dataDir: string;
  /** Lathe's own data folder, loaded beside dataDir with read-only rows, or null. */
  readonly latheDataDir: string | null;
  private readonly instance: DuckDBInstance;
  private readonly main: DuckDBConnection;
  private readonly baseSchema: SchemaDescription;
  private currentSchema!: SchemaDescription;
  private schemaDb = '';
  private dataDb = '';
  /** The tables the current data database was built whole from: the current ones, unless a reload or a write changed tables since. */
  private dbTables: Tables = new Map();
  private tables: Tables = new Map();
  private origins = new WeakMap<Row, Origin>();
  /** The rows loaded from latheDataDir, which no write changes or writes out. */
  private builtIn = new WeakSet<Row>();
  /** Each table's rows sorted by key, by the map that holds them (a map is never changed once it is the current state's). */
  private readonly sorted = new WeakMap<Map<string, Row>, Row[]>();
  private queue: Promise<unknown> = Promise.resolve();
  private closing: Promise<void> | undefined;
  private readonly steps: Record<string, number> | undefined;
  /** Each data file as the tables hold it: its size and modification time, by its path. */
  private signatures = new Map<string, string>();
  /** Moved on whenever the current state changes: a whole build of an older one is not adopted. */
  private generation = 0;
  /** The state last built whole: the current one, unless a reload or a write changed tables since. */
  private builtWhole: Whole = { tables: new Map(), signatures: new Map() };
  /** Whether the database holds the current state (false after a reload or a write held without one, until the next whole build). */
  private built = true;
  /** The data files as a reload last refused them, as one key, with the refusal. */
  private refused: { key: string; error: StoreError } | undefined;
  /** What each load or reload that found a write a crash had left did with it (journal.ts), oldest first. */
  readonly settled: Settled[] = [];
  /** The whole builds in progress, which close waits for. */
  private readonly building = new Set<Promise<unknown>>();
  /** The tables each aggregate's rules read, and each reader's projection. */
  private readonly ruleReads = new ReadSets<AggregateRules>();
  private readonly readerReads = new ReadSets<ReaderFactory>();
  /** Each read model's reader over the current state, made when a query first asks and kept until a table it read changes. */
  private readonly readers = new Map<ReaderFactory, unknown>();

  constructor(instance: DuckDBInstance, connection: DuckDBConnection, baseSchema: SchemaDescription, dataDir: string, latheDataDir: string | null, steps?: Record<string, number>) {
    this.instance = instance;
    this.main = connection;
    this.baseSchema = baseSchema;
    this.dataDir = dataDir;
    this.latheDataDir = latheDataDir;
    this.steps = steps;
  }

  // Runs one step of a load, timing it when the store was opened with steps.
  private async step<T>(name: string, run: () => T | Promise<T>): Promise<T> {
    if (!this.steps) return run();
    const start = performance.now();
    try {
      return await run();
    } finally {
      this.steps[name] = Math.round((performance.now() - start) * 10) / 10;
    }
  }

  // Runs the work after every write and reload before it, as the only one.
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Whether the row is one of Lathe's own, loaded from latheDataDir, and so read-only. */
  isBuiltIn(row: Row): boolean {
    return this.builtIn.has(row);
  }

  /** The schema, Lathe's and the product's own kinds and relations. */
  get schema(): SchemaDescription {
    return this.currentSchema;
  }

  // The database is the current state's only after a load that built it or a whole build; after a load of validated
  // files, or a reload or a write held without one, ensureDatabase() or whole() builds it.
  private get database(): string {
    if (!this.built) throw new Error('The store changed in part (a reload or a write) or was loaded from validated files since its database was built: call ensureDatabase() or run SQL through whole().');
    return this.dataDb;
  }

  /** A connection whose current database holds the current data, once ensureDatabase() has built it. It follows every load and whole build. */
  get connection(): DuckDBConnection {
    void this.database;
    return this.main;
  }

  /** A new connection on the current data, for queries run side by side; it reads the data as it was until the next whole build. */
  async connect(): Promise<DuckDBConnection> {
    await this.ensureDatabase();
    const database = this.database;
    const connection = await this.instance.connect();
    await connection.run(`USE ${sqlName(database)}`);
    return connection;
  }

  /**
   * Seals the database against everything outside it (LA-CHK-INV06): a load has sealed it already, and the check run
   * asks again before any check's query runs.
   */
  seal(): Promise<void> {
    return seal(this.instance);
  }

  /** Runs a query on the current data and returns its rows as JSON values. */
  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    await this.ensureDatabase();
    return (await this.main.runAndReadAll(sql)).getRowObjectsJson() as unknown as T[];
  }

  /** A table's rows, sorted by key. */
  rows(table: string): Row[] {
    const description = this.currentSchema.tables[table];
    if (!description) throw new StoreError([{ rule: 'unknown-table', message: `there is no table ${table}` }]);
    // Each table's rows are sorted once for the map that holds them, until a reload or a write replaces it.
    const rows = this.tables.get(table);
    if (!rows) return [];
    let sorted = this.sorted.get(rows);
    if (!sorted) {
      sorted = sortRows(description, [...rows.values()]);
      this.sorted.set(rows, sorted);
    }
    return [...sorted];
  }

  /** The record with this ID, with its kind, or undefined. */
  record(id: string): { kind: string; row: Row } | undefined {
    for (const kind of Object.keys(this.currentSchema.kinds)) {
      const row = this.tables.get(kind)?.get(id);
      if (row) return { kind, row };
    }
    return undefined;
  }

  /** Where a row came from: its file and line, or the command that wrote it. */
  origin(row: Row): Origin | undefined {
    return this.origins.get(row);
  }

  /**
   * The read model's reader over the current data: made by its factory the first time a query asks for it, then kept
   * until a table its projection read changes (a reload, a write), so a change rebuilds only the projections it touches.
   */
  readerOf<D>(make: (view: ReadView) => D): D {
    if (this.readers.has(make)) return this.readers.get(make) as D;
    const reads = new Set<string>();
    // A projection may read a reader the store keeps for several (the records' placement): it reads what that read.
    const view: ReadView = {
      ...trackedView(this.currentSchema, this.tables, reads, (table) => this.rows(table)),
      dataDir: this.dataDir,
      readerOf: (inner) => {
        const shared = this.readerOf(inner);
        for (const table of this.readerReads.of(inner) ?? []) reads.add(table);
        return shared;
      },
    };
    const reader = make(view);
    this.readerReads.add(make, reads);
    this.readers.set(make, reader);
    return reader;
  }

  /** Whether a change to these tables changes what the reader's read model answers: its projection read one, or never ran here. */
  readerTouched(make: ReaderFactory, changed: ReadonlySet<string>): boolean {
    return this.readerReads.touched(make, changed);
  }

  // Forgets the readers whose projections read a changed table (every reader, for 'all').
  private forgetReaders(changed: Iterable<string> | 'all') {
    if (changed === 'all') return this.readers.clear();
    const tables = new Set(changed);
    for (const make of [...this.readers.keys()]) if (this.readerReads.touched(make, tables)) this.readers.delete(make);
  }

  /** Waits for the write in progress and the whole builds, then drops the store's databases and closes its connection. A second call does nothing. */
  close(): Promise<void> {
    this.closing ??= (async () => {
      await this.queue;
      while (this.building.size) await Promise.allSettled([...this.building]);
      try {
        await this.main.run(`USE ${BASE_DB}`);
        if (this.dataDb) await this.detach(this.dataDb);
      } finally {
        this.main.closeSync();
        live--;
      }
    })();
    return this.closing;
  }

  // Loading.

  // Settles a write a crash left in the product's data folder (journal.ts) before its files are read, and says what it did.
  private async settle() {
    const settled = await settleWrite(this.dataDir);
    if (!settled) return;
    this.settled.push(settled);
    console.warn(`lathe: ${settled.message}`);
  }

  // The data folders, Lathe's own first and then the product's, with their data files in order.
  private folders(): Folder[] {
    const listed = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort() : []);
    return [
      ...(this.latheDataDir ? [{ dir: this.latheDataDir, display: 'lathe/data', builtIn: true }] : []),
      { dir: this.dataDir, display: path.basename(this.dataDir), builtIn: false },
    ].map((f) => ({ ...f, files: listed(f.dir) }));
  }

  // Reads one data file's rows into the table's map, each normalized, with its origin; a problem is added, not thrown.
  private readFile(schema: SchemaDescription, folder: Folder, file: string, tables: Tables, problems: StoreProblem[], text = readFileSync(path.join(folder.dir, file), 'utf8')) {
    const name = file.slice(0, -'.jsonl'.length);
    const table = schema.tables[name];
    const display = `${folder.display}/${file}`;
    if (!table?.stored) {
      problems.push({ rule: 'unknown-table', file: display, line: 1, message: `${file} names no stored table; data files are named <table>.jsonl` });
      return;
    }
    // A table's rows from both folders share one map, so a key given in both is a duplicate.
    const rows = tables.get(name) ?? new Map<string, Row>();
    const lines = text.split('\n');
    if (lines.at(-1) === '') lines.pop();
    lines.forEach((text, index) => {
      const line = index + 1;
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch (error) {
        problems.push({ rule: 'json', file: display, line, table: name, message: `the line is not one JSON object: ${(error as Error).message}` });
        return;
      }
      const result = normalizeRow(table, value);
      if ('problem' in result) {
        problems.push({ rule: result.problem.includes('is required') ? 'required' : 'column', file: display, line, table: name, message: result.problem });
        return;
      }
      const key = rowKey(table, result.row);
      const earlier = rows.get(key);
      if (earlier) {
        const at = this.origins.get(earlier) as { file: string; line: number };
        const where = at.file === display ? `line ${at.line}` : `${at.file}:${at.line}`;
        problems.push({ rule: 'primary-key', file: display, line, table: name, key: describeKey(table, result.row), message: `${name} ${describeKey(table, result.row)} is already on ${where}` });
        return;
      }
      rows.set(key, result.row);
      this.origins.set(result.row, { file: display, line });
      if (folder.builtIn) this.builtIn.add(result.row);
    });
    tables.set(name, rows);
  }

  /**
   * Reads every data file, Lathe's own folder's first and then the product's, and loads them whole. Called by openStore,
   * and by a reload that must start afresh. Files whose whole build passed before, exactly as they are now (their
   * validated-build stamp, cache.ts), are read without building them again: the store holds their rows, and builds
   * their database only when SQL first needs it (ensureDatabase()). Any other files are built whole, and stamped when they pass.
   */
  async load(): Promise<void> {
    await this.settle();
    const folders = this.folders();
    // The files' sizes and times are taken before they are read, so a file changed while it is read reads again.
    const signatures = signaturesOf(folders);
    // Each file is read once; the stamp's key is of the very text the rows are read from.
    const texts = await this.step('read texts', () => new Map(folders.flatMap((folder) => folder.files.map((file) => [path.join(folder.dir, file), readFileSync(path.join(folder.dir, file), 'utf8')] as const))));
    const key = validatedKey((await sharedEngine()).key, texts);
    const validated = await this.step('validated stamp', () => isValidated(key));
    const problems: StoreProblem[] = [];
    const tables: Tables = new Map();
    const read = (schema: SchemaDescription, folder: Folder, file: string) => this.readFile(schema, folder, file, tables, problems, texts.get(path.join(folder.dir, file)));

    // The declarations, with the products that declare them, are read first: the Product aggregate's rules judge them
    // before the schema is built from them.
    const isDeclaration = (file: string) => ([...DECLARATION_TABLES, 'product'] as readonly string[]).includes(file.slice(0, -'.jsonl'.length));
    await this.step('read declarations', () => {
      for (const folder of folders) for (const file of folder.files.filter(isDeclaration)) read(this.baseSchema, folder, file);
    });
    if (problems.length) throw new StoreError(problems);
    const { schemaDb, schema } = await this.step('schema', () => this.buildSchema(tables, this.origins));
    // The empty database the data goes into is copied while the files are read; validated files need none yet.
    if (!validated) this.prepareSpare(schemaDb, schema);
    await this.step('read files', () => {
      for (const folder of folders) for (const file of folder.files.filter((f) => !isDeclaration(f))) read(schema, folder, file);
    });
    if (problems.length) throw new StoreError(problems);

    if (validated) {
      // The same files passed a whole build: they hold every key, check, integrity query and rule. The previous
      // database, of a reload that loaded afresh, no longer holds the current state.
      const previous = this.dataDb;
      this.dataDb = '';
      this.dbTables = new Map();
      if (previous) await this.detach(previous);
      this.schemaDb = schemaDb;
      this.currentSchema = schema;
      this.tables = tables;
      this.signatures = signatures;
      this.becameWhole('all');
      this.built = false;
      return;
    }
    const dataDb = await this.buildData(schemaDb, schema, tables, this.origins);
    this.schemaDb = schemaDb;
    this.currentSchema = schema;
    this.tables = tables;
    this.signatures = signatures;
    this.becameWhole('all');
    await this.switchTo(dataDb, tables);
    markValidated(key);
  }

  /**
   * A key of the data as its files hold it now, Lathe's own folder's and the product's: the base schema's key, the
   * engine's code and each file's exact contents, as a load's validated-build stamp is keyed (cache.ts). Two stores
   * over the same files give the same key.
   */
  async contentKey(): Promise<string> {
    const texts = this.folders().flatMap((folder) => folder.files.map((file) => [path.join(folder.dir, file), readFileSync(path.join(folder.dir, file), 'utf8')] as const));
    return validatedKey((await sharedEngine()).key, texts);
  }

  /**
   * Builds the current state's database when the store holds none (a load of validated files, a reload or a write
   * held without one), through whole(); a store that holds one is left as it is. SQL reads (query, connect) call it.
   */
  async ensureDatabase(): Promise<void> {
    while (!this.built) {
      if (this.closing) throw new Error('The store is closing.');
      await this.whole(async () => undefined);
    }
  }

  // The current state was built whole (a load, a write): the database holds it, and a refused full check comes back to it.
  private becameWhole(changed: Iterable<string> | 'all') {
    this.generation++;
    this.built = true;
    this.builtWhole = { tables: this.tables, signatures: this.signatures };
    this.forgetReaders(changed);
  }

  /**
   * Reads the data files that changed since the tables were last read or written, and only their tables (LA-PLT-UC03-R03):
   * a change set from one write, or a burst of them, is one reload. The changed tables are held at once to the keys
   * (each row's foreign keys, every row pointing into them, their unique keys, every ID once across kinds) and to the
   * rules of each aggregate that reads one of them; the database's checks, the integrity queries and every rule then
   * run in the background (whole()). When anything is broken, the whole build runs at once and refuses with every
   * problem, as a load from scratch would, and nothing changes. A changed declaration of the product's own kinds or
   * relations, or a file of no table, loads every file afresh.
   */
  reload(): Promise<Reloaded> {
    return this.serial(async () => {
      await this.settle();
      const folders = this.folders();
      const signatures = signaturesOf(folders);
      const files = [...new Set([...signatures.keys(), ...this.signatures.keys()])].filter((file) => signatures.get(file) !== this.signatures.get(file));
      if (!files.length) return { files, tables: [], full: false };
      // Files that were refused as they are now are refused again without reading them.
      const key = [...signatures].map(([file, signature]) => `${file}:${signature}`).join('\n');
      if (this.refused?.key === key) throw this.refused.error;
      try {
        return await this.reloadFiles(folders, signatures, files);
      } catch (error) {
        if (error instanceof StoreError) this.refused = { key, error };
        throw error;
      }
    });
  }

  // Reads the changed files' tables again (reload).
  private async reloadFiles(folders: Folder[], signatures: Map<string, string>, files: string[]): Promise<Reloaded> {
    const schema = this.currentSchema;
    const names = new Set(files.map((file) => path.basename(file, '.jsonl')));
    if ([...names].some((name) => !schema.tables[name]?.stored || (DECLARATION_TABLES as readonly string[]).includes(name))) {
      await this.load();
      return { files, tables: Object.values(this.currentSchema.tables).filter((t) => t.stored).map((t) => t.name).sort(), full: true };
    }
    // The changed tables, read again from both folders in the order a load reads them.
    const problems: StoreProblem[] = [];
    const read: Tables = new Map([...names].map((name) => [name, new Map<string, Row>()]));
    await this.step('reload read files', () => {
      for (const folder of folders) for (const file of folder.files) if (names.has(file.slice(0, -'.jsonl'.length))) this.readFile(schema, folder, file, read, problems);
    });
    if (problems.length) throw new StoreError(problems);
    // A table whose rows and lines are the same as before (a file touched, or written back as it was) keeps its rows.
    const next: Tables = new Map(this.tables);
    const changed = new Set<string>();
    for (const [name, rows] of read) {
      if (sameRows(this.tables.get(name), rows, this.origins)) continue;
      next.set(name, rows);
      changed.add(name);
    }
    if (changed.size && !(await this.holds(schema, this.tables, next, changed))) {
      // Something is broken: the whole build names every problem, as a load from scratch does.
      const dataDb = await this.buildData(this.schemaDb, schema, next, this.origins);
      this.tables = next;
      this.signatures = signatures;
      this.becameWhole(changed);
      await this.switchTo(dataDb, next);
      return { files, tables: [...changed].sort(), full: false };
    }
    this.tables = next;
    this.signatures = signatures;
    if (changed.size) {
      this.generation++;
      this.built = false;
      this.forgetReaders(changed);
    }
    return { files, tables: [...changed].sort(), full: false };
  }

  // Whether the changed tables keep every key and the rules of each aggregate that reads them (what a reload holds at
  // once). The IDs are held once across kinds only when a changed kind's IDs are not those it had before.
  private async holds(schema: SchemaDescription, before: Tables, tables: Tables, changed: ReadonlySet<string>): Promise<boolean> {
    const registered = await this.step('reload registry', () => sameIds(schema, before, tables, changed) || !this.registry(schema, tables, this.origins).problems.length);
    if (!registered || !(await this.step('reload keys', () => keysHold(schema, tables, changed)))) return false;
    for (const rules of AGGREGATE_RULES) {
      if (!this.ruleReads.touched(rules, changed)) continue;
      const reads = new Set<string>();
      const problems = await this.step(`reload rules of ${rules.aggregate}`, () => rules.check(trackedView(schema, tables, reads, (table) => [...(tables.get(table)?.values() ?? [])])));
      this.ruleReads.add(rules, reads);
      if (problems.length) return false;
    }
    return true;
  }

  /**
   * Whether a write's new state holds to everything its whole build holds it to, without building it (LA-PLT-UC03-R05):
   * the keys and the rules of each aggregate that reads a changed table (as a reload holds them), then, in a database
   * of views over the current data database with the tables that differ from it beside them, each such row's NOT NULL
   * and CHECK constraints, record_scope and every integrity query. When it holds, the write needs no database of its
   * own: the whole build (the checks') follows in the background, and passes. When it does not, the whole build runs
   * at once and refuses with every problem, as it always has.
   */
  private async writeHolds(schema: SchemaDescription, tables: Tables, changed: ReadonlySet<string>): Promise<boolean> {
    if (!this.dataDb || !(await this.holds(schema, this.tables, tables, changed))) return false;
    const base = this.dbTables;
    const differ = new Set(Object.values(schema.tables).filter((t) => t.stored && tables.get(t.name) !== base.get(t.name)).map((t) => t.name));
    // The registry and the supertypes follow the kinds' IDs, and record_scope the columns it reads: each is the data
    // database's own while those are as it holds them.
    const derived = sameIds(schema, base, tables, differ) ? new Map<string, Row[]>() : this.registry(schema, tables, this.origins).rows;
    const scopeColumns = recordScopeColumns(schema);
    const sameScope = [...differ].every((table) => !scopeColumns.has(table) || sameColumns(base.get(table), tables.get(table), scopeColumns.get(table)!));
    const overlay = `lathe_overlay_${++databases}`;
    await seal(this.instance);
    const connection = await this.instance.connect();
    try {
      await connection.run(`ATTACH ':memory:' AS ${sqlName(overlay)}; USE ${sqlName(overlay)}`);
      const views: string[] = [];
      for (const table of Object.values(schema.tables)) {
        const rows = derived.get(table.name) ?? (differ.has(table.name) ? [...(tables.get(table.name)?.values() ?? [])] : null);
        if (!rows) {
          views.push(`CREATE VIEW ${sqlName(table.name)} AS SELECT * FROM ${sqlName(this.dataDb)}.${sqlName(table.name)};`);
          continue;
        }
        // The keys are held already; the table keeps its columns' own constraints.
        const columns = table.columns.map((c) => `${sqlName(c.name)} ${c.sqlType}${c.required ? ' NOT NULL' : ''}`);
        await connection.run(`CREATE TABLE ${sqlName(table.name)} (${[...columns, ...table.checks.map((check) => `CHECK (${check})`)].join(', ')})`);
        if (rows.length) await this.step(`write holds: ${table.name}`, () => appendRows(connection, overlay, table, rows));
      }
      await this.step('write holds: views', () => connection.run(views.join('\n')));
      await connection.run(storeViewsSql(schema));
      await this.step('write holds: record_scope', () =>
        connection.run(sameScope ? `CREATE VIEW record_scope AS SELECT * FROM ${sqlName(this.dataDb)}.record_scope` : recordScopeSql(schema)));
      await connection.run(useCaseGroupsSql(schema));
      // The integrity queries only read, so they run side by side on a few connections.
      const queries = allIntegrityQueries(schema);
      const extra = await Promise.all(
        Array.from({ length: Math.min(VALIDATION_CONNECTIONS, queries.length) - 1 }, async () => {
          const other = await this.instance.connect();
          await other.run(`USE ${sqlName(overlay)}`);
          return other;
        }),
      );
      try {
        let next = 0;
        let found = 0;
        await this.step('write holds: integrity queries, side by side', () =>
          Promise.all(
            [connection, ...extra].map(async (on) => {
              while (next < queries.length && !found) {
                // Read before it is added: `found += await …` would add to the count as it was before the wait.
                const rows = (await on.runAndReadAll(queries[next++].sql)).currentRowCount;
                found += rows;
              }
            }),
          ),
        );
        return !found;
      } finally {
        for (const other of extra) other.closeSync();
      }
    } catch {
      // A row its table's constraints refuse, or anything else the database refuses: the whole build decides, and
      // names every problem.
      return false;
    } finally {
      await connection.run(`USE ${BASE_DB}; DETACH DATABASE IF EXISTS ${sqlName(overlay)}`).catch(() => undefined);
      connection.closeSync();
    }
  }

  /**
   * Builds the current state whole in a database of its own (every key and check, the integrity queries and every
   * aggregate's rules) and runs the work on a store that holds it, such as the check rows and coverage; then drops it.
   * Answers null when the state changed while it was built (a newer reload or write; another whole build follows it).
   * When the build refuses the current state, the store goes back to the state last built whole, so its files read
   * again on the next reload, and the refusal is thrown: a load from scratch would refuse the same. When the state is
   * still the current one after the work, the database becomes the store's own.
   */
  async whole<T>(work: (built: Store) => Promise<T>): Promise<{ value: T } | null> {
    const run = (async () => {
      const { generation, tables, currentSchema: schema, schemaDb, signatures } = this;
      let dataDb: string;
      try {
        dataDb = await this.buildData(schemaDb, schema, tables, this.origins);
      } catch (error) {
        if (!(error instanceof StoreError)) throw error;
        const current = await this.serial(async () => {
          if (this.generation !== generation) return false;
          // The files as they are refused: a reload of them as they are refuses again without building them.
          this.refused = { key: [...signatures].map(([file, signature]) => `${file}:${signature}`).join('\n'), error };
          this.tables = this.builtWhole.tables;
          this.signatures = this.builtWhole.signatures;
          // The database was left holding the state last built whole.
          this.becameWhole('all');
          return true;
        });
        if (current) throw error;
        return null;
      }
      if (this.generation !== generation) {
        await this.main.run(`DETACH DATABASE IF EXISTS ${sqlName(dataDb)}`).catch(() => undefined);
        return null;
      }
      this.builtWhole = { tables, signatures };
      live++;
      const built = new Store(this.instance, await this.instance.connect(), this.baseSchema, this.dataDir, this.latheDataDir);
      built.currentSchema = schema;
      built.schemaDb = schemaDb;
      built.tables = tables;
      built.origins = this.origins;
      built.builtIn = this.builtIn;
      try {
        await built.switchTo(dataDb, tables);
        const value = await work(built);
        // Still the current state: its database becomes the store's, so SQL needs no whole build again and the next
        // write holds its changes against it.
        await this.serial(async () => {
          if (this.generation !== generation || this.closing) return;
          built.dataDb = '';
          await this.switchTo(dataDb, tables);
          this.built = true;
        });
        return { value };
      } finally {
        await built.close();
      }
    })();
    this.building.add(run);
    const settled = () => this.building.delete(run);
    run.then(settled, settled);
    return run;
  }

  // The schema database: Lathe's migrations, copied from lathe_base, then the product's kinds and relations; or the
  // schema cache's file of the same. Each set of declarations is built once per process and shared by every store
  // that declares the same; a schema database holds no data, so it is never dropped.
  private async buildSchema(tables: Tables, origins: WeakMap<Row, Origin>): Promise<{ schemaDb: string; schema: SchemaDescription }> {
    const declarations = {
      kinds: [...(tables.get('product_kind')?.values() ?? [])],
      fields: [...(tables.get('product_kind_field')?.values() ?? [])],
      relations: [...(tables.get('product_relation')?.values() ?? [])],
    };
    // Without a product kind or relation, the schema is Lathe's own.
    if (!declarations.kinds.length && !declarations.fields.length && !declarations.relations.length) {
      return { schemaDb: BASE_DB, schema: this.baseSchema };
    }
    // The declarations are held to the Product aggregate's own rules (LA-PRD-INV22 to INV24) before any table is built
    // from them; what is left to refuse here is only how a field becomes a column.
    const broken = productRules.check(readView(this.baseSchema, tables)).filter((p) => (DECLARATION_TABLES as readonly string[]).includes(p.table));
    if (broken.length) throw new StoreError(broken.map((p) => problemAt(origins, p.row, { rule: p.rule, table: p.table, message: p.message })));
    const { sql, problems } = productKindSql(this.baseSchema, declarations);
    if (problems.length) {
      throw new StoreError(problems.map((p: DeclarationProblem) => problemAt(origins, p.row, { rule: 'product-kind', table: p.table, message: p.message })));
    }
    let built = schemaDatabases.get(sql);
    if (!built) {
      built = (async () => {
        const name = `lathe_schema_${++databases}`;
        const key = productKey((await sharedEngine()).key, sql);
        const builder = await this.instance.connect();
        try {
          const cached = await withFiles(this.instance, () => attachCached(builder, name, key));
          if (cached) return { schemaDb: name, schema: cached };
          await builder.run(`ATTACH ':memory:' AS ${sqlName(name)}`);
          await copyDatabase(builder, BASE_DB, name, false);
          await builder.run(`USE ${sqlName(name)}`);
          // A declaration DuckDB refuses (a pair Lathe already allows, a folder that does not exist) is a refusal.
          await builder.run(sql).catch((error: Error) => {
            throw new StoreError([{ rule: 'product-kind', message: `the product's kinds and relations cannot be added: ${error.message.split('\n')[0]}` }]);
          });
          await builder.run(storeViewsSql(await describeSchema(builder)));
          const schema = await describeSchema(builder);
          cache(this.instance, name, key, schema);
          return { schemaDb: name, schema };
        } finally {
          builder.closeSync();
        }
      })();
      schemaDatabases.set(sql, inBackground(built));
      built.catch(() => schemaDatabases.delete(sql));
    }
    return built;
  }

  // The registry and supertype rows every kind row brings, or the IDs two records share.
  private registry(schema: SchemaDescription, tables: Tables, origins: WeakMap<Row, Origin>): { rows: Map<string, Row[]>; problems: StoreProblem[] } {
    const problems: StoreProblem[] = [];
    const ids = new Map<string, Located>();
    const registry: Row[] = [];
    const supertypes = new Map<string, Row[]>(Object.keys(schema.supertypes).map((s) => [s, []]));
    // Rows from files come first, so a clash is reported on the row a write brings.
    const located: Located[] = Object.keys(schema.kinds)
      .sort()
      .flatMap((kind) => [...(tables.get(kind)?.values() ?? [])].map((row) => ({ table: kind, row })));
    const fromFile = (l: Located) => (origins.get(l.row) && 'file' in origins.get(l.row)! ? 0 : 1);
    located.sort((a, b) => fromFile(a) - fromFile(b));
    for (const { table: kind, row } of located) {
      const id = String(row.id);
      const earlier = ids.get(id);
      if (earlier) {
        const at = origins.get(earlier.row);
        const where = at && 'file' in at ? ` (${at.file}:${at.line})` : '';
        problems.push(problemAt(origins, row, { rule: 'unique-id', table: kind, key: id, message: `the ID ${id} is already a ${earlier.table}${where}; an ID is unique across every kind` }));
        continue;
      }
      ids.set(id, { table: kind, row });
      registry.push({ id, kind });
      for (const supertype of schema.kinds[kind].supertypes) supertypes.get(supertype)!.push({ id, kind });
    }
    return { rows: new Map([['record_id', registry], ...supertypes]), problems };
  }

  // Builds the data in a fresh database copied from the schema database: the registry and every table in dependency
  // order inside one transaction, then record_scope, the integrity queries and every aggregate's rules. Returns the database's name, or
  // throws a StoreError and drops the database.
  private async buildData(schemaDb: string, schema: SchemaDescription, tables: Tables, origins: WeakMap<Row, Origin>): Promise<string> {
    const { rows: derived, problems } = await this.step('registry', () => this.registry(schema, tables, origins));
    if (problems.length) throw new StoreError(problems);
    const name = await this.step('copy schema', () => this.emptyDatabase(schemaDb, schema));
    const builder = await this.instance.connect();
    const discard = async () => {
      await builder.run(`USE ${sqlName(schemaDb)}`);
      await builder.run(`DETACH ${sqlName(name)}`);
    };
    try {
      await builder.run(`USE ${sqlName(name)}`);
      const order = ['record_id', ...Object.keys(schema.supertypes).sort(), ...schema.loadOrder];
      const rowsOf = (table: string) => derived.get(table) ?? [...(tables.get(table)?.values() ?? [])];
      // Every table's rows go in through an appender, in dependency order. When the database refuses a row, the
      // inserts run again table by table as JSON, to find the table that broke a key or check and the rows that did.
      const filled = order.filter((table) => rowsOf(table).length);
      await builder.run('BEGIN TRANSACTION');
      try {
        for (const table of filled) await this.step(`insert ${table}`, () => appendRows(builder, name, schema.tables[table], rowsOf(table)));
      } catch {
        await builder.run('ROLLBACK');
        await builder.run('BEGIN TRANSACTION');
        for (const table of filled) {
          try {
            await insertRows(builder, schema.tables[table], rowsOf(table));
          } catch (error) {
            await builder.run('ROLLBACK');
            const found = await this.diagnose(builder, schema, table, order, rowsOf, origins, error);
            await discard();
            throw new StoreError(found);
          }
        }
      }
      // The database is the store's own until switchTo makes it current, so the rows are committed before the
      // integrity queries run, and a refusal drops the database whole. DuckDB reads committed tables far faster
      // than a transaction's own uncommitted rows (a join over them can take a hundred times as long).
      await this.step('commit', () => builder.run('COMMIT'));
      // No query of the data runs on an instance open to files (LA-CHK-INV06): the schema cache's writes end first.
      await this.step('seal', () => seal(this.instance)).catch(async (error: unknown) => {
        await discard();
        throw error;
      });
      await this.step('record_scope', () => builder.run(recordScopeSql(schema)));
      await builder.run(useCaseGroupsSql(schema));
      await this.step('views made tables', () => builder.run(materializeViewsSql()));
      // The integrity queries only read, so they run side by side on a few connections; their problems keep the
      // queries' order.
      const queries = allIntegrityQueries(schema);
      const found: { table_name: string; row_key: string; message: string }[][] = new Array(queries.length);
      const extra = await Promise.all(
        Array.from({ length: Math.min(VALIDATION_CONNECTIONS, queries.length) - 1 }, async () => {
          const connection = await this.instance.connect();
          await connection.run(`USE ${sqlName(name)}`);
          return connection;
        }),
      );
      let next = 0;
      try {
        await this.step('integrity queries, side by side', () =>
          Promise.all(
            [builder, ...extra].map(async (on) => {
              while (next < queries.length) {
                const at = next++;
                found[at] = await this.step(`integrity ${queries[at].name}`, async () => (await on.runAndReadAll(queries[at].sql)).getRowObjectsJson() as unknown as (typeof found)[number]);
              }
            }),
          ),
        );
      } finally {
        for (const connection of extra) connection.closeSync();
      }
      const broken: StoreProblem[] = [];
      for (const [at, query] of queries.entries()) {
        for (const r of found[at]) {
          const row = tables.get(r.table_name)?.get(r.row_key);
          const key = row ? describeKey(schema.tables[r.table_name], row) : r.row_key;
          broken.push(problemAt(origins, row, { rule: query.name, table: r.table_name, key, message: r.message }));
        }
      }
      // Every aggregate's rules, over all data.
      for (const rules of AGGREGATE_RULES) {
        const reads = new Set<string>();
        const view = trackedView(schema, tables, reads, (table) => [...(tables.get(table)?.values() ?? [])]);
        const found = await this.step(`rules of ${rules.aggregate}`, () => rules.check(view));
        this.ruleReads.add(rules, reads);
        for (const p of found) {
          // The row as the data holds it, so the problem names its file and line, or its command.
          const row = tables.get(p.table)?.get(rowKey(schema.tables[p.table], p.row)) ?? p.row;
          broken.push(problemAt(origins, row, { rule: p.rule, table: p.table, key: describeKey(schema.tables[p.table], row), message: p.message }));
        }
      }
      if (broken.length) {
        await discard();
        throw new StoreError(broken);
      }
      return name;
    } finally {
      builder.closeSync();
      // The next load or write of this schema finds its empty database ready, unless the process ends after its one
      // command.
      if (!oneCommand) this.prepareSpare(schemaDb, schema);
    }
  }

  // An empty data database of the schema: the spare made after the last load, or a new copy.
  private async emptyDatabase(schemaDb: string, schema: SchemaDescription): Promise<string> {
    const spare = spares.get(schemaDb);
    spares.delete(schemaDb);
    return (spare && (await spare.catch(() => undefined))) || this.copySchema(schemaDb, schema);
  }

  private prepareSpare(schemaDb: string, schema: SchemaDescription) {
    if (spares.has(schemaDb)) return;
    const spare = inBackground(this.copySchema(schemaDb, schema));
    spares.set(schemaDb, spare);
    spare.catch(() => spares.delete(schemaDb));
  }

  // A new database with the schema database's tables, views and meta-model rows, and no data.
  private async copySchema(schemaDb: string, schema: SchemaDescription): Promise<string> {
    const name = `lathe_data_${++databases}`;
    const copier = await this.instance.connect();
    try {
      await copier.run(`ATTACH ':memory:' AS ${sqlName(name)}`);
      await copyDatabase(copier, schemaDb, name, true);
      // The meta-model's rows come along; the data tables start empty.
      await copier.run(
        Object.values(schema.tables)
          .filter((t) => t.role === 'meta')
          .map((t) => `INSERT INTO ${sqlName(name)}.${sqlName(t.name)} SELECT * FROM ${sqlName(schemaDb)}.${sqlName(t.name)};`)
          .join('\n'),
      );
      return name;
    } finally {
      copier.closeSync();
    }
  }

  // Finds which rows of a table broke a key or check, after its insert failed: first the foreign keys and unique keys,
  // checked here so every broken row is named; then, for a CHECK constraint, by inserting the rows one at a time.
  private async diagnose(
    builder: DuckDBConnection,
    schema: SchemaDescription,
    failed: string,
    order: string[],
    rowsOf: (table: string) => Row[],
    origins: WeakMap<Row, Origin>,
    error: unknown,
  ): Promise<StoreProblem[]> {
    const table = schema.tables[failed];
    const rows = rowsOf(failed);
    const problems: StoreProblem[] = [];
    const indexes = new Map<string, Map<string, Row>>();
    const index = (target: string, columns: string[]) => {
      const id = `${target}(${columns.join(',')})`;
      let map = indexes.get(id);
      if (!map) {
        map = new Map();
        for (const r of rowsOf(target)) map.set(columns.map((c) => String(r[c])).join('\u0000'), r);
        indexes.set(id, map);
      }
      return map;
    };
    for (const row of rows) {
      const key = describeKey(table, row);
      for (const fk of table.foreignKeys) {
        const values = fk.columns.map((c) => row[c]);
        if (values.some((v) => v === undefined)) continue;
        if (index(fk.table, fk.references).has(values.map(String).join('\u0000'))) continue;
        problems.push(problemAt(origins, row, { rule: 'foreign-key', table: failed, key, message: foreignKeyMessage(schema, failed, fk, row, (t, c) => index(t, c)) }));
      }
      for (const unique of table.unique) {
        const values = unique.map((c) => row[c]);
        if (values.some((v) => v === undefined)) continue;
        const twin = rows.find((other) => other !== row && unique.every((c) => other[c] === row[c]));
        if (twin && rows.indexOf(twin) < rows.indexOf(row)) {
          problems.push(problemAt(origins, row, { rule: 'unique', table: failed, key, message: `${failed} ${key} has the same ${unique.join(', ')} as ${failed} ${describeKey(table, twin)}: ${values.join(', ')}` }));
        }
      }
    }
    if (problems.length) return problems;
    // Insert everything before the table, then the table row by row, to find the row a CHECK refuses.
    await builder.run('BEGIN TRANSACTION');
    try {
      for (const other of order) {
        if (other === failed) break;
        const before = rowsOf(other);
        if (before.length) await insertRows(builder, schema.tables[other], before);
      }
      for (const row of rows) {
        try {
          await insertRows(builder, table, [row]);
        } catch (rowError) {
          const message = (rowError as Error).message.split('\n')[0].replace(/^[A-Za-z ]+Error: /, '');
          return [problemAt(origins, row, { rule: 'check', table: failed, key: describeKey(table, row), message: `${failed} ${describeKey(table, row)} breaks a rule of its table: ${message}` })];
        }
      }
    } finally {
      await builder.run('ROLLBACK').catch(() => undefined);
    }
    return [{ rule: 'database', table: failed, message: `${failed} could not be loaded: ${(error as Error).message.split('\n')[0]}` }];
  }

  // Makes the given database, built whole from the tables, the current data, for the main connection, and drops the one before.
  private async switchTo(dataDb: string, tables: Tables) {
    const previous = this.dataDb;
    await this.main.run(`USE ${sqlName(dataDb)}`);
    this.dataDb = dataDb;
    this.dbTables = tables;
    if (previous) await this.detach(previous);
  }

  // Drops a database no connection of the store uses any more.
  private async detach(name: string) {
    await this.main.run(`DETACH DATABASE IF EXISTS ${sqlName(name)}`).catch(() => undefined);
  }

  // Writing.

  /**
   * Runs the work as one transaction, after every write before it: the work changes the transaction's draft through
   * its aggregate's repository, and the commit then holds the new state to every refusal of its whole build (built
   * whole only when it changes the product's kinds or relations, or something is refused) and rewrites the changed
   * files. A refusal, from the work or the commit, changes nothing. A write not built whole leaves its whole build to
   * whole(), as a reload does.
   */
  transact<T>(work: (tx: Transaction) => T | Promise<T>, checked?: CheckedProblems): Promise<{ value: T; committed: Committed }> {
    return this.serial(async () => {
      const tx = new Transaction(this.host(), checked);
      const value = await work(tx);
      const schema = this.currentSchema;
      const committed = await commit(tx);
      // The files it wrote are as the tables hold them, so no reload reads them again.
      const signatures = new Map(this.signatures);
      for (const file of committed.files) {
        const full = path.join(this.dataDir, file);
        if (existsSync(full)) signatures.set(full, signatureOf(full));
        else signatures.delete(full);
      }
      this.signatures = signatures;
      const changed = this.currentSchema === schema ? committed.tables : 'all';
      if (this.built) this.becameWhole(changed);
      else {
        this.generation++;
        this.forgetReaders(changed);
      }
      return { value, committed };
    });
  }

  // What the store lends a transaction: its state as it is now, and how to build and adopt the next.
  private host(): TransactionHost {
    return {
      dataDir: this.dataDir,
      schema: this.currentSchema,
      schemaDb: this.schemaDb,
      tables: this.tables,
      origins: this.origins,
      builtIn: this.builtIn,
      buildSchema: (tables, origins) => this.buildSchema(tables, origins),
      build: async (schemaDb, schema, tables, origins, changed) =>
        schemaDb === this.schemaDb && (await this.step('write holds', () => this.writeHolds(schema, tables, changed))) ? null : this.buildData(schemaDb, schema, tables, origins),
      discard: (dataDb) => this.detach(dataDb),
      adopt: async (state) => {
        this.tables = state.tables;
        this.currentSchema = state.schema;
        this.schemaDb = state.schemaDb;
        this.built = state.dataDb !== null;
        if (state.dataDb !== null) await this.switchTo(state.dataDb, state.tables);
      },
    };
  }
}

/** A data file's size and modification time, as one string. */
const signatureOf = (file: string): string => {
  const info = statSync(file);
  return `${info.size}:${info.mtimeMs}`;
};

/** Every data file of the folders, by its path, with its signature. */
// The integrity queries of the schema, then each aggregate's rules that only the database can judge.
function allIntegrityQueries(schema: SchemaDescription): IntegrityQuery[] {
  return [...integrityQueries(schema), ...AGGREGATE_RULES.flatMap((rules) => rules.queries ?? [])];
}

function signaturesOf(folders: Folder[]): Map<string, string> {
  return new Map(folders.flatMap((folder) => folder.files.map((file) => {
    const full = path.join(folder.dir, file);
    return [full, signatureOf(full)] as const;
  })));
}

/** Whether each changed kind holds the same IDs as before: the registry and the supertypes are as they were. */
function sameIds(schema: SchemaDescription, before: Tables, after: Tables, changed: Iterable<string>): boolean {
  for (const table of changed) {
    if (!schema.kinds[table]) continue;
    const [a, b] = [before.get(table), after.get(table)];
    if ((a?.size ?? 0) !== (b?.size ?? 0)) return false;
    for (const key of b?.keys() ?? []) if (!a!.has(key)) return false;
  }
  return true;
}

/** Whether a table's rows hold the same keys, and the same values in these columns, as before. */
function sameColumns(before: Map<string, Row> | undefined, after: Map<string, Row> | undefined, columns: readonly string[]): boolean {
  if ((before?.size ?? 0) !== (after?.size ?? 0)) return false;
  for (const [key, row] of after ?? []) {
    const was = before!.get(key);
    if (!was || columns.some((column) => (was[column] ?? null) !== (row[column] ?? null))) return false;
  }
  return true;
}

/** Whether a table read again holds the same rows, each on the same line of the same file, as before. */
function sameRows(before: Map<string, Row> | undefined, after: Map<string, Row>, origins: WeakMap<Row, Origin>): boolean {
  if ((before?.size ?? 0) !== after.size) return false;
  for (const [key, row] of after) {
    const was = before!.get(key);
    if (!was || JSON.stringify(was) !== JSON.stringify(row)) return false;
    const [a, b] = [origins.get(was), origins.get(row)];
    if (a?.file !== b?.file || a?.line !== b?.line) return false;
  }
  return true;
}

/** The tables as the aggregates' rules read them. */
function readView(schema: SchemaDescription, tables: Tables): ReadView {
  return {
    schema,
    rows: (table) => [...(tables.get(table)?.values() ?? [])],
    record: (id) => {
      for (const kind of Object.keys(schema.kinds)) {
        const row = tables.get(kind)?.get(id);
        if (row) return { kind, row };
      }
      return undefined;
    },
  };
}

// A foreign key's failure in words: the value that names nothing, or the parent that sits elsewhere.
function foreignKeyMessage(
  schema: SchemaDescription,
  tableName: string,
  fk: { columns: string[]; table: string; references: string[] },
  row: Row,
  index: (table: string, columns: string[]) => Map<string, Row>,
): string {
  const table = schema.tables[tableName];
  const key = describeKey(table, row);
  const target = schema.tables[fk.table];
  const what = target.role === 'supertype' ? `${fk.table} (${schema.supertypes[fk.table].join(', ')})` : target.role === 'registry' ? 'record' : fk.table;
  const idAt = fk.references.indexOf(target.primaryKey[0]);
  if (fk.columns.length === 1 || idAt < 0) {
    return `${tableName} ${key}: ${fk.columns.map((c) => `${c} ${JSON.stringify(row[c])}`).join(', ')} names no ${what}`;
  }
  const id = row[fk.columns[idAt]];
  const parent = index(fk.table, [target.primaryKey[0]]).get(String(id));
  if (!parent) return `${tableName} ${key}: ${fk.columns[idAt]} ${JSON.stringify(id)} names no ${what}`;
  const differ = fk.references
    .map((ref, i) => ({ ref, mine: row[fk.columns[i]], theirs: parent[ref] }))
    .filter((d) => d.ref !== target.primaryKey[0] && d.mine !== d.theirs);
  return `${tableName} ${key}: its ${fk.table} ${id} has ${differ.map((d) => `${d.ref} ${JSON.stringify(d.theirs ?? null)}`).join(', ')}, but it gives ${differ.map((d) => `${fk.columns[fk.references.indexOf(d.ref)]} ${JSON.stringify(d.mine)}`).join(', ')}`;
}
