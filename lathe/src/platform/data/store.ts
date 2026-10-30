// The store: loads data/*.jsonl into the typed tables, and runs each write as a transaction (transaction.ts). A load
// and a write build their state the same way: in a fresh database, every row inside one transaction, judged by the
// keys and checks, the integrity queries (integrity.ts) and every aggregate's rules (AGGREGATE_RULES); only then does it
// become the current state.
//
// Why a fresh database: DuckDB checks a foreign key as each statement runs, even inside a transaction, so it refuses
// to delete or re-key a row that another row references, even when the same transaction removes that reference
// first. Building the new state afresh, parents before children, keeps every key real and every write atomic.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { AGGREGATE_RULES } from '../../aggregate-rules.ts';
import { loadConfig, PACKAGE_DIR } from '../../config.ts';
import { attachCached, baseKey, copyDatabase, productKey, writeCached } from './cache.ts';
import { appendRows, insertRows } from './insert.ts';
import { integrityQueries, recordScopeSql, storeViewsSql } from './integrity.ts';
import { problemAt, StoreError, type Origin, type StoreProblem } from './problems.ts';
import { productKindSql, type DeclarationProblem } from './product-kinds.ts';
import type { Located } from './references.ts';
import type { ReadView } from './rules.ts';
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

// Writes a schema database built afresh to the schema cache, while nothing waits on it.
function cache(instance: DuckDBInstance, schemaDb: string, key: string, schema: SchemaDescription) {
  inBackground(
    (async () => {
      const writer = await instance.connect();
      try {
        await writeCached(writer, schemaDb, key, schema);
      } finally {
        writer.closeSync();
      }
    })(),
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

/** A product repo's data: the typed tables in DuckDB, kept in step with the data files. */
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
  private tables: Tables = new Map();
  private origins = new WeakMap<Row, Origin>();
  /** The rows loaded from latheDataDir, which no write changes or writes out. */
  private builtIn = new WeakSet<Row>();
  private queue: Promise<unknown> = Promise.resolve();
  private closing: Promise<void> | undefined;
  private readonly steps: Record<string, number> | undefined;

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

  /** Whether the row is one of Lathe's own, loaded from latheDataDir, and so read-only. */
  isBuiltIn(row: Row): boolean {
    return this.builtIn.has(row);
  }

  /** The schema, Lathe's and the product's own kinds and relations. */
  get schema(): SchemaDescription {
    return this.currentSchema;
  }

  /** A connection whose current database holds the current data. It follows every write. */
  get connection(): DuckDBConnection {
    return this.main;
  }

  /** A new connection on the current data, for queries run side by side; it reads the data as it was until the next write. */
  async connect(): Promise<DuckDBConnection> {
    const connection = await this.instance.connect();
    await connection.run(`USE ${sqlName(this.dataDb)}`);
    return connection;
  }

  /** Runs a query on the current data and returns its rows as JSON values. */
  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    return (await this.main.runAndReadAll(sql)).getRowObjectsJson() as unknown as T[];
  }

  /**
   * Where each record with no owner sits, from record_scope: its product, and its domain (a specification's from its
   * ID; a view's, integration's, UI component's or value object's the one domain that uses it), or null when shared.
   * What sits under a record follows it, so a reader that walks the parents needs only these.
   */
  async placements(): Promise<Record<string, { product: string | null; domain: string | null }>> {
    const rows = await this.query<{ id: string; product_id: string | null; domain_id: string | null }>(
      "SELECT s.id, s.product_id, s.domain_id FROM record_scope s JOIN record_parent p ON p.id = s.id WHERE p.parent_id IS NULL AND p.kind <> 'product' ORDER BY s.id",
    );
    return Object.fromEntries(rows.map((r) => [r.id, { product: r.product_id, domain: r.domain_id }]));
  }

  /** A table's rows, sorted by key. */
  rows(table: string): Row[] {
    const description = this.currentSchema.tables[table];
    if (!description) throw new StoreError([{ rule: 'unknown-table', message: `there is no table ${table}` }]);
    return sortRows(description, [...(this.tables.get(table)?.values() ?? [])]);
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

  /** Waits for the write in progress, then drops the store's databases and closes its connection. A second call does nothing. */
  close(): Promise<void> {
    this.closing ??= (async () => {
      await this.queue;
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

  /** Reads every data file, Lathe's own folder's first and then the product's, and loads them. Called once, by openStore. */
  async load(): Promise<void> {
    const listed = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort() : []);
    const folders = [
      ...(this.latheDataDir ? [{ dir: this.latheDataDir, display: 'lathe/data', builtIn: true }] : []),
      { dir: this.dataDir, display: path.basename(this.dataDir), builtIn: false },
    ].map((f) => ({ ...f, files: listed(f.dir) }));
    const problems: StoreProblem[] = [];
    const tables: Tables = new Map();
    const read = (schema: SchemaDescription, folder: (typeof folders)[number], file: string) => {
      const name = file.slice(0, -'.jsonl'.length);
      const table = schema.tables[name];
      const display = `${folder.display}/${file}`;
      if (!table?.stored) {
        problems.push({ rule: 'unknown-table', file: display, line: 1, message: `${file} names no stored table; data files are named <table>.jsonl` });
        return;
      }
      // A table's rows from both folders share one map, so a key given in both is a duplicate.
      const rows = tables.get(name) ?? new Map<string, Row>();
      const lines = readFileSync(path.join(folder.dir, file), 'utf8').split('\n');
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
    };

    const isDeclaration = (file: string) => (DECLARATION_TABLES as readonly string[]).includes(file.slice(0, -'.jsonl'.length));
    await this.step('read declarations', () => {
      for (const folder of folders) for (const file of folder.files.filter(isDeclaration)) read(this.baseSchema, folder, file);
    });
    if (problems.length) throw new StoreError(problems);
    const { schemaDb, schema } = await this.step('schema', () => this.buildSchema(tables, this.origins));
    // The empty database the data goes into is copied while the files are read.
    this.prepareSpare(schemaDb, schema);
    await this.step('read files', () => {
      for (const folder of folders) for (const file of folder.files.filter((f) => !isDeclaration(f))) read(schema, folder, file);
    });
    if (problems.length) throw new StoreError(problems);

    const dataDb = await this.buildData(schemaDb, schema, tables, this.origins);
    this.schemaDb = schemaDb;
    this.currentSchema = schema;
    this.tables = tables;
    await this.switchTo(dataDb);
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
          const cached = await attachCached(builder, name, key);
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
      await this.step('record_scope', () => builder.run(recordScopeSql(schema)));
      // The integrity queries only read, so they run side by side on a few connections; their problems keep the
      // queries' order.
      const queries = integrityQueries(schema);
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
      const view = readView(schema, tables);
      for (const rules of AGGREGATE_RULES) {
        for (const p of await this.step(`rules of ${rules.aggregate}`, () => rules.check(view))) {
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

  // Makes the given database the current data, for the main connection, and drops the one before.
  private async switchTo(dataDb: string) {
    const previous = this.dataDb;
    await this.main.run(`USE ${sqlName(dataDb)}`);
    this.dataDb = dataDb;
    if (previous) await this.detach(previous);
  }

  // Drops a database no connection of the store uses any more.
  private async detach(name: string) {
    await this.main.run(`DETACH DATABASE IF EXISTS ${sqlName(name)}`).catch(() => undefined);
  }

  // Writing.

  /**
   * Runs the work as one transaction, after every write before it: the work changes the transaction's draft through
   * its aggregate's repository, and the commit then builds the new state whole and rewrites the changed files. A
   * refusal, from the work or the commit, changes nothing.
   */
  transact<T>(work: (tx: Transaction) => T | Promise<T>): Promise<{ value: T; committed: Committed }> {
    const run = this.queue.then(async () => {
      const tx = new Transaction(this.host());
      const value = await work(tx);
      return { value, committed: await commit(tx) };
    });
    this.queue = run.catch(() => undefined);
    return run;
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
      buildData: (schemaDb, schema, tables, origins) => this.buildData(schemaDb, schema, tables, origins),
      adopt: async (state) => {
        this.tables = state.tables;
        this.currentSchema = state.schema;
        this.schemaDb = state.schemaDb;
        await this.switchTo(state.dataDb);
      },
    };
  }
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
