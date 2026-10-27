// The store: loads data/*.jsonl into the typed tables and writes through one command layer. Every write builds the
// new state in a fresh database inside one transaction (keys, checks, then the validation queries), and only then
// replaces the current state and rewrites the files of the tables it changed.
//
// Why a fresh database: DuckDB checks a foreign key as each statement runs, even inside a transaction, so it refuses
// to delete or re-key a row that another row references, even when the same transaction removes that reference
// first. Building the new state afresh, parents before children, keeps every key real and every write atomic.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { loadConfig } from '../config.ts';
import { insertRows } from './insert.ts';
import { productKindSql, type DeclarationProblem } from './product-kinds.ts';
import { describeKey, normalizeRow, rowKey, sortRows, tableText, type Row, type Value } from './rows.ts';
import { applyMigrations, describeSchema, readMigrations, sqlName, type SchemaDescription, type TableDescription } from './schema.ts';
import { storeViewsSql, validationQueries } from './validation.ts';

/** Where a row came from: a line of a data file, or a command of the write that made or changed it. */
export type Origin = { file: string; line: number } | { command: number };

/** One reason the store refused data or a write. */
export interface StoreProblem {
  /** The rule broken, such as foreign-key, unique, check, required or relation-pair. */
  rule: string;
  message: string;
  table?: string;
  /** The row's key, such as TL-LEND-UC01. */
  key?: string;
  /** The data file and line, for a row loaded from a file. */
  file?: string;
  line?: number;
  /** The command's place in the write, from 0, for a row a write made or changed. */
  command?: number;
}

/** The store refused to load or to write; nothing changed. */
export class StoreError extends Error {
  readonly problems: StoreProblem[];
  constructor(problems: StoreProblem[]) {
    super(problems.map(formatProblem).join('\n'));
    this.name = 'StoreError';
    this.problems = problems;
  }
}

/** A problem as one line: where, then what. */
export function formatProblem(p: StoreProblem): string {
  const where = p.file ? `${p.file}:${p.line}` : p.command !== undefined ? `command ${p.command + 1}` : p.table ? p.table : 'data';
  return `${where}: ${p.message} [${p.rule}]`;
}

/** One write operation. A write is a list of them, applied together in one transaction. */
export type Command =
  /** Adds a row to a kind, part, declaration or checking table. A record's row carries its id and title. */
  | { op: 'add'; table: string; row: Row }
  /** Changes columns of a row; a value of null clears the column. Keys and a record's parent columns stay (see move). */
  | { op: 'set'; table: string; key: KeyInput; changes: Record<string, Value | null> }
  /** Moves a record under another parent, setting its parent columns, and its descendants' derived ones, to match. */
  | { op: 'move'; id: string; parent: string }
  /** Links two records with a relation. */
  | { op: 'link'; relation: string; source: string; target: string }
  /** Removes a link. */
  | { op: 'unlink'; relation: string; source: string; target: string }
  /** Removes a row. A record goes with its parts and its own links; anything else that references it refuses it. */
  | { op: 'remove'; table: string; key: KeyInput };

/** A row's key: a record's ID, or the primary key columns of a part, declaration or checking row. */
export type KeyInput = string | Record<string, Value>;

/** What a write changed. */
export interface WriteResult {
  /** The tables whose rows changed. */
  tables: string[];
  /** The data files written or removed, relative to the data folder. */
  files: string[];
}

export interface StoreOptions {
  /** The data folder, in place of the one lathe.config.json names (default data/ at the root). */
  dataDir?: string;
}

const DECLARATION_TABLES = ['product_kind', 'product_kind_field', 'product_relation'] as const;

type Tables = Map<string, Map<string, Row>>;

interface Located {
  table: string;
  row: Row;
}

const problemAt = (origins: WeakMap<Row, Origin>, row: Row | undefined, p: StoreProblem): StoreProblem => {
  const origin = row ? origins.get(row) : undefined;
  if (!origin) return p;
  return 'file' in origin ? { ...p, file: origin.file, line: origin.line } : { ...p, command: origin.command };
};

// One DuckDB instance serves every store in the process. Its lathe_base database holds Lathe's migrations, applied
// once; each store copies it into databases of its own, named uniquely.
interface Engine {
  instance: DuckDBInstance;
  baseSchema: SchemaDescription;
}
let engine: Promise<Engine> | undefined;
const BASE_DB = 'lathe_base';
// The schema databases built for products' own kinds and relations, by the SQL that adds them.
const schemaDatabases = new Map<string, Promise<{ schemaDb: string; schema: SchemaDescription }>>();
let databases = 0;

function sharedEngine(): Promise<Engine> {
  engine ??= (async () => {
    const instance = await DuckDBInstance.create(':memory:');
    const connection = await instance.connect();
    try {
      await connection.run(`ATTACH ':memory:' AS ${BASE_DB}`);
      await connection.run(`USE ${BASE_DB}`);
      await applyMigrations(connection, readMigrations());
      const baseSchema = await describeSchema(connection);
      await connection.run(storeViewsSql(baseSchema));
      return { instance, baseSchema };
    } finally {
      connection.closeSync();
    }
  })();
  return engine;
}

/** Opens the store of the product repo at root: reads its data files and loads them with every key and check. */
export async function openStore(root: string, options: StoreOptions = {}): Promise<Store> {
  const dataDir = path.resolve(options.dataDir ?? loadConfig(root).dataDir);
  const { instance, baseSchema } = await sharedEngine();
  const store = new Store(instance, await instance.connect(), baseSchema, dataDir);
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
  private readonly instance: DuckDBInstance;
  private readonly main: DuckDBConnection;
  private readonly baseSchema: SchemaDescription;
  private currentSchema!: SchemaDescription;
  private schemaDb = '';
  private dataDb = '';
  private tables: Tables = new Map();
  private origins = new WeakMap<Row, Origin>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(instance: DuckDBInstance, connection: DuckDBConnection, baseSchema: SchemaDescription, dataDir: string) {
    this.instance = instance;
    this.main = connection;
    this.baseSchema = baseSchema;
    this.dataDir = dataDir;
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

  /** A table's rows, sorted by key. */
  rows(table: string): Row[] {
    this.tableOf(table);
    return sortRows(this.tableOf(table), [...(this.tables.get(table)?.values() ?? [])]);
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

  /** Drops the store's databases and closes its connection. */
  async close(): Promise<void> {
    await this.main.run(`USE ${BASE_DB}`);
    if (this.dataDb) await this.detach(this.dataDb);
    this.main.closeSync();
  }

  // Loading.

  /** Reads every data file and loads it. Called once, by openStore. */
  async load(): Promise<void> {
    const files = existsSync(this.dataDir) ? readdirSync(this.dataDir).filter((f) => f.endsWith('.jsonl')).sort() : [];
    const problems: StoreProblem[] = [];
    const tables: Tables = new Map();
    const read = (schema: SchemaDescription, file: string) => {
      const name = file.slice(0, -'.jsonl'.length);
      const table = schema.tables[name];
      const display = path.join(path.basename(this.dataDir), file);
      if (!table?.stored) {
        problems.push({ rule: 'unknown-table', file: display, line: 1, message: `${file} names no stored table; data files are named <table>.jsonl` });
        return;
      }
      const rows = new Map<string, Row>();
      const lines = readFileSync(path.join(this.dataDir, file), 'utf8').split('\n');
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
          const at = this.origins.get(earlier) as { line: number };
          problems.push({ rule: 'primary-key', file: display, line, table: name, key: describeKey(table, result.row), message: `${name} ${describeKey(table, result.row)} is already on line ${at.line}` });
          return;
        }
        rows.set(key, result.row);
        this.origins.set(result.row, { file: display, line });
      });
      tables.set(name, rows);
    };

    const declarationFiles = files.filter((f) => (DECLARATION_TABLES as readonly string[]).includes(f.slice(0, -'.jsonl'.length)));
    for (const file of declarationFiles) read(this.baseSchema, file);
    if (problems.length) throw new StoreError(problems);
    const { schemaDb, schema } = await this.buildSchema(tables, this.origins);
    for (const file of files.filter((f) => !declarationFiles.includes(f))) read(schema, file);
    if (problems.length) throw new StoreError(problems);

    const dataDb = await this.buildData(schemaDb, schema, tables, this.origins);
    this.schemaDb = schemaDb;
    this.currentSchema = schema;
    this.tables = tables;
    await this.switchTo(dataDb);
  }

  // The schema database: Lathe's migrations, copied from lathe_base, then the product's kinds and relations. Each
  // set of declarations is built once per process and shared by every store that declares the same; a schema
  // database holds no data, so it is never dropped.
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
        const builder = await this.instance.connect();
        try {
          await builder.run(`ATTACH ':memory:' AS ${sqlName(name)}`);
          await builder.run(`COPY FROM DATABASE ${BASE_DB} TO ${sqlName(name)}`);
          await builder.run(`USE ${sqlName(name)}`);
          await builder.run(sql);
          await builder.run(storeViewsSql(await describeSchema(builder)));
          return { schemaDb: name, schema: await describeSchema(builder) };
        } finally {
          builder.closeSync();
        }
      })();
      schemaDatabases.set(sql, built);
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

  // Builds the data in a fresh database copied from the schema database, inside one transaction: the registry, every
  // table in dependency order, then the validation queries. Returns the database's name, or throws a StoreError.
  private async buildData(schemaDb: string, schema: SchemaDescription, tables: Tables, origins: WeakMap<Row, Origin>): Promise<string> {
    const { rows: derived, problems } = this.registry(schema, tables, origins);
    if (problems.length) throw new StoreError(problems);
    const name = `lathe_data_${++databases}`;
    const builder = await this.instance.connect();
    const discard = async () => {
      await builder.run(`USE ${sqlName(schemaDb)}`);
      await builder.run(`DETACH ${sqlName(name)}`);
    };
    try {
      await builder.run(`ATTACH ':memory:' AS ${sqlName(name)}`);
      await builder.run(`COPY FROM DATABASE ${sqlName(schemaDb)} TO ${sqlName(name)} (SCHEMA)`);
      await builder.run(`USE ${sqlName(name)}`);
      // The meta-model's rows come along; the data tables start empty.
      await builder.run(
        Object.values(schema.tables)
          .filter((t) => t.role === 'meta')
          .map((t) => `INSERT INTO ${sqlName(t.name)} SELECT * FROM ${sqlName(schemaDb)}.${sqlName(t.name)};`)
          .join('\n'),
      );
      const order = ['record_id', ...Object.keys(schema.supertypes).sort(), ...schema.loadOrder];
      const rowsOf = (table: string) => derived.get(table) ?? [...(tables.get(table)?.values() ?? [])];
      await builder.run('BEGIN TRANSACTION');
      for (const table of order) {
        const rows = rowsOf(table);
        if (!rows.length) continue;
        const ordered = this.levels(schema.tables[table], rows, origins);
        if ('problems' in ordered) {
          await builder.run('ROLLBACK');
          await discard();
          throw new StoreError(ordered.problems);
        }
        try {
          for (const level of ordered.levels) await insertRows(builder, schema.tables[table], level);
        } catch (error) {
          await builder.run('ROLLBACK');
          const found = await this.diagnose(builder, schema, table, order, rowsOf, origins, error);
          await discard();
          throw new StoreError(found);
        }
      }
      const broken: StoreProblem[] = [];
      for (const query of validationQueries(schema)) {
        const rows = (await builder.runAndReadAll(query.sql)).getRowObjectsJson() as unknown as { table_name: string; row_key: string; message: string }[];
        for (const r of rows) {
          const row = tables.get(r.table_name)?.get(r.row_key);
          const key = row ? describeKey(schema.tables[r.table_name], row) : r.row_key;
          broken.push(problemAt(origins, row, { rule: query.name, table: r.table_name, key, message: r.message }));
        }
      }
      if (broken.length) {
        await builder.run('ROLLBACK');
        await discard();
        throw new StoreError(broken);
      }
      await builder.run('COMMIT');
      return name;
    } finally {
      builder.closeSync();
    }
  }

  // Splits a table's rows into levels, so a row comes in a later level than the row of the same table it points at
  // (a sub-layer after its layer): DuckDB checks a row's foreign key against the rows already in the table, not the
  // others of the same statement, so each level is inserted on its own. Rows that point at each other in a cycle
  // cannot be loaded.
  private levels(table: TableDescription, rows: Row[], origins: WeakMap<Row, Origin>): { levels: Row[][] } | { problems: StoreProblem[] } {
    const self = table.foreignKeys.filter((fk) => fk.table === table.name);
    if (!self.length) return { levels: [rows] };
    const byKey = new Map(rows.map((r) => [rowKey(table, r), r]));
    const depth = new Map<Row, number>();
    const visiting = new Set<Row>();
    const problems: StoreProblem[] = [];
    const visit = (row: Row): number => {
      const known = depth.get(row);
      if (known !== undefined) return known;
      if (visiting.has(row)) {
        problems.push(problemAt(origins, row, { rule: 'foreign-key', table: table.name, key: describeKey(table, row), message: `${table.name} ${describeKey(table, row)} sits inside itself, through a cycle of ${table.name} rows` }));
        depth.set(row, 0);
        return 0;
      }
      visiting.add(row);
      let level = 0;
      for (const fk of self) {
        const at = fk.references.indexOf(table.primaryKey[0]);
        const value = at < 0 ? undefined : row[fk.columns[at]];
        const target = value === undefined ? undefined : byKey.get(String(value));
        if (target && target !== row) level = Math.max(level, visit(target) + 1);
      }
      visiting.delete(row);
      depth.set(row, level);
      return level;
    };
    for (const row of rows) visit(row);
    if (problems.length) return { problems: [...new Map(problems.map((p) => [p.key, p])).values()] };
    const levels: Row[][] = [];
    for (const row of rows) (levels[depth.get(row)!] ??= []).push(row);
    return { levels };
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
        const split = this.levels(schema.tables[other], before, origins);
        for (const level of 'levels' in split ? split.levels : [before]) if (level.length) await insertRows(builder, schema.tables[other], level);
      }
      const ordered = this.levels(table, rows, origins);
      for (const row of 'levels' in ordered ? ordered.levels.flat() : rows) {
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

  /** Applies the commands together, in one transaction: all of them, or none. */
  apply(commands: Command[]): Promise<WriteResult> {
    const run = this.queue.then(() => this.write(commands));
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Adds a row: a record to its kind's table, or a part, declaration or checking row. */
  add(table: string, row: Row): Promise<WriteResult> {
    return this.apply([{ op: 'add', table, row }]);
  }

  /** Changes columns of a row; null clears one. */
  set(table: string, key: KeyInput, changes: Record<string, Value | null>): Promise<WriteResult> {
    return this.apply([{ op: 'set', table, key, changes }]);
  }

  /** Moves a record under another parent. */
  move(id: string, parent: string): Promise<WriteResult> {
    return this.apply([{ op: 'move', id, parent }]);
  }

  /** Links source to target with the relation. */
  link(relation: string, source: string, target: string): Promise<WriteResult> {
    return this.apply([{ op: 'link', relation, source, target }]);
  }

  /** Removes the link. */
  unlink(relation: string, source: string, target: string): Promise<WriteResult> {
    return this.apply([{ op: 'unlink', relation, source, target }]);
  }

  /** Removes a row; a record goes with its parts and its own links, and is refused while anything else references it. */
  remove(table: string, key: KeyInput): Promise<WriteResult> {
    return this.apply([{ op: 'remove', table, key }]);
  }

  private tableOf(name: string, schema = this.currentSchema): TableDescription {
    const table = schema.tables[name];
    if (!table) throw new StoreError([{ rule: 'unknown-table', message: `there is no table ${name}` }]);
    return table;
  }

  private async write(commands: Command[]): Promise<WriteResult> {
    const draft: Tables = new Map(this.tables);
    const origins = this.origins;
    const changed = new Set<string>();
    const editable = (name: string) => {
      if (!changed.has(name)) {
        draft.set(name, new Map(draft.get(name) ?? []));
        changed.add(name);
      }
      return draft.get(name)!;
    };
    let schema = this.currentSchema;
    for (const [index, command] of commands.entries()) {
      const fail = (rule: string, message: string): never => {
        throw new StoreError([{ rule, message, command: index }]);
      };
      const place = (table: string, row: Row) => {
        editable(table).set(rowKey(schema.tables[table], row), row);
        origins.set(row, { command: index });
      };
      if (command.op === 'add') {
        const table = this.tableOf(command.table, schema);
        if (!table.stored || table.role === 'link') fail('command', `add puts rows in kind, part, declaration and checking tables; ${table.name} is a ${table.role} table${table.role === 'link' ? ', so use link' : ''}`);
        const result = normalizeRow(table, command.row);
        if ('problem' in result) fail(result.problem.includes('is required') ? 'required' : 'column', result.problem);
        const row = (result as { row: Row }).row;
        if (draft.get(table.name)?.has(rowKey(table, row))) fail('primary-key', `${table.name} ${describeKey(table, row)} already exists`);
        place(table.name, row);
      } else if (command.op === 'set') {
        const table = this.tableOf(command.table, schema);
        const current = this.find(draft, table, command.key) ?? fail('missing', `there is no ${table.name} ${keyText(command.key)}`);
        const parentColumns = new Set(schema.kinds[table.name]?.parents.map((p) => p.column) ?? []);
        const next: Record<string, unknown> = { ...current };
        for (const [column, value] of Object.entries(command.changes)) {
          if (table.primaryKey.includes(column)) fail('command', `${column} is part of the key of ${table.name}, which never changes; remove the row and add another`);
          if (parentColumns.has(column)) fail('command', `${column} places the record under its parent; use move`);
          next[column] = value;
        }
        const result = normalizeRow(table, next);
        if ('problem' in result) fail(result.problem.includes('is required') ? 'required' : 'column', result.problem);
        editable(table.name).delete(rowKey(table, current));
        place(table.name, (result as { row: Row }).row);
      } else if (command.op === 'move') {
        this.moveRecord(schema, draft, command.id, command.parent, fail, place);
      } else if (command.op === 'link' || command.op === 'unlink') {
        const relation = schema.relations[command.relation] ?? fail('unknown-relation', `there is no relation ${command.relation}; the relations are ${Object.keys(schema.relations).join(', ')}`);
        const table = schema.tables[relation.name];
        const row: Row = { source_id: command.source, target_id: command.target };
        const exists = draft.get(table.name)?.has(rowKey(table, row));
        if (command.op === 'link') {
          if (exists) fail('primary-key', `${command.source} already ${relation.forwardLabel.toLowerCase()} ${command.target}`);
          place(table.name, row);
        } else {
          if (!exists) fail('missing', `${command.source} does not ${relation.name} ${command.target}`);
          editable(table.name).delete(rowKey(table, row));
        }
      } else if (command.op === 'remove') {
        const table = this.tableOf(command.table, schema);
        const row = this.find(draft, table, command.key) ?? fail('missing', `there is no ${table.name} ${keyText(command.key)}`);
        const removed = this.removalSet(schema, draft, table, row);
        const referrers = this.referrers(schema, draft, removed);
        if (referrers.length) {
          const shown = referrers.slice(0, 20).join('; ');
          fail('referenced', `${table.name} ${describeKey(table, row)} is referenced, so it stays: ${shown}${referrers.length > 20 ? `; and ${referrers.length - 20} more` : ''}`);
        }
        for (const r of removed) editable(r.table).delete(rowKey(schema.tables[r.table], r.row));
      }
      // A change to the product's own kinds or relations changes the schema the later commands see.
      if ((DECLARATION_TABLES as readonly string[]).includes('table' in command ? command.table : '') && index < commands.length - 1) {
        schema = (await this.buildSchema(draft, origins)).schema;
      }
    }

    let schemaDb = this.schemaDb;
    if (DECLARATION_TABLES.some((t) => changed.has(t))) {
      const built = await this.buildSchema(draft, origins);
      schemaDb = built.schemaDb;
      schema = built.schema;
      // Rows of product kinds are checked again against their (possibly changed) columns.
      const problems: StoreProblem[] = [];
      for (const name of Object.keys(schema.kinds).filter((k) => schema.kinds[k].productId !== null)) {
        for (const row of draft.get(name)?.values() ?? []) {
          const result = normalizeRow(schema.tables[name], row);
          if ('problem' in result) problems.push(problemAt(origins, row, { rule: 'column', table: name, key: String(row.id), message: result.problem }));
        }
      }
      for (const name of draft.keys()) {
        if (!schema.tables[name] && draft.get(name)!.size) problems.push({ rule: 'unknown-table', table: name, message: `${name} has rows but is no longer a kind or relation` });
      }
      if (problems.length) throw new StoreError(problems);
    }
    const dataDb = await this.buildData(schemaDb, schema, draft, origins);
    this.tables = draft;
    this.currentSchema = schema;
    this.schemaDb = schemaDb;
    await this.switchTo(dataDb);
    const files = await this.writeFiles([...changed].sort());
    return { tables: [...changed].sort(), files };
  }

  private find(tables: Tables, table: TableDescription, key: KeyInput): Row | undefined {
    const values: Row = typeof key === 'string' ? { [table.primaryKey[0]]: key } : key;
    if (typeof key === 'string' && table.primaryKey.length !== 1) return undefined;
    return tables.get(table.name)?.get(rowKey(table, values));
  }

  // The record's parent: the first of its kind's parent columns, nearest first, that holds a value.
  private parentOf(schema: SchemaDescription, kind: string, row: Row): string | undefined {
    for (const p of schema.kinds[kind].parents) if (row[p.column] !== undefined) return String(row[p.column]);
    return undefined;
  }

  private kindOf(schema: SchemaDescription, tables: Tables, id: string): string | undefined {
    return Object.keys(schema.kinds).find((k) => tables.get(k)?.has(id));
  }

  // The record and its ancestors, nearest first, as (kind, id).
  private ancestry(schema: SchemaDescription, tables: Tables, id: string): { kind: string; id: string }[] {
    const chain: { kind: string; id: string }[] = [];
    let current: string | undefined = id;
    while (current && chain.length < 64) {
      const kind = this.kindOf(schema, tables, current);
      if (!kind) break;
      chain.push({ kind, id: current });
      current = this.parentOf(schema, kind, tables.get(kind)!.get(current)!);
    }
    return chain;
  }

  // The parent columns a record under `parent` holds: the column for the parent's kind, and every parent column that
  // is required or shares a foreign key with one already set, filled from the parent's ancestry. The rest are cleared.
  private parentColumns(schema: SchemaDescription, tables: Tables, kind: string, parent: string): Record<string, string | undefined> | string {
    const parentKind = this.kindOf(schema, tables, parent);
    if (!parentKind) return `there is no record ${parent}`;
    const options = schema.kinds[kind].parents;
    const chosen = options.find((p) => p.kind === parentKind);
    if (!chosen) return `a ${kind} sits under ${options.map((p) => p.kind).join(' or ')}, not under ${parentKind} ${parent}`;
    const table = schema.tables[kind];
    const required = new Set(table.columns.filter((c) => c.required).map((c) => c.name));
    const names = new Set(options.map((p) => p.column));
    const set = new Set([chosen.column]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const column of names) {
        if (set.has(column)) continue;
        if (required.has(column) || table.foreignKeys.some((fk) => fk.columns.includes(column) && fk.columns.some((c) => set.has(c)))) {
          set.add(column);
          grew = true;
        }
      }
    }
    const ancestry = this.ancestry(schema, tables, parent);
    const values: Record<string, string | undefined> = {};
    for (const option of options) {
      values[option.column] = set.has(option.column) ? ancestry.find((a) => a.kind === option.kind)?.id : undefined;
    }
    return values;
  }

  private moveRecord(
    schema: SchemaDescription,
    tables: Tables,
    id: string,
    parent: string,
    fail: (rule: string, message: string) => never,
    place: (table: string, row: Row) => void,
  ) {
    const kind = this.kindOf(schema, tables, id) ?? fail('missing', `there is no record ${id}`);
    if (!schema.kinds[kind].parents.length) fail('command', `a ${kind} sits under nothing, so it cannot move`);
    if (this.ancestry(schema, tables, parent).some((a) => a.id === id)) fail('command', `${id} cannot move under ${parent}, which sits inside it`);
    const columns = this.parentColumns(schema, tables, kind, parent);
    if (typeof columns === 'string') fail('parent', columns);
    const relocate = (recordKind: string, row: Row, values: Record<string, string | undefined>) => {
      const next: Row = { ...row };
      for (const [column, value] of Object.entries(values)) {
        if (value === undefined) delete next[column];
        else next[column] = value;
      }
      if (Object.keys(values).some((column) => next[column] !== row[column])) place(recordKind, next);
    };
    relocate(kind, tables.get(kind)!.get(id)!, columns as Record<string, string | undefined>);
    // Descendants keep their parent, and take its new place for the parent columns derived from it.
    const children = new Map<string, { kind: string; id: string }[]>();
    for (const k of Object.keys(schema.kinds)) {
      for (const row of tables.get(k)?.values() ?? []) {
        const p = this.parentOf(schema, k, row);
        if (p) children.set(p, [...(children.get(p) ?? []), { kind: k, id: String(row.id) }]);
      }
    }
    const walk = (of: string) => {
      for (const child of children.get(of) ?? []) {
        const row = tables.get(child.kind)!.get(child.id)!;
        const values = this.parentColumns(schema, tables, child.kind, of);
        if (typeof values !== 'string') relocate(child.kind, row, values);
        walk(child.id);
      }
    };
    walk(id);
  }

  // What removing a row takes with it: a record's parts (and theirs), and the links it starts.
  private removalSet(schema: SchemaDescription, tables: Tables, table: TableDescription, row: Row): Located[] {
    const removed: Located[] = [{ table: table.name, row }];
    if (table.role !== 'kind') return removed;
    const id = String(row.id);
    for (const t of Object.values(schema.tables)) {
      const rows = [...(tables.get(t.name)?.values() ?? [])];
      if (t.role === 'part' && t.ownerColumn) removed.push(...rows.filter((r) => r[t.ownerColumn!] === id).map((r) => ({ table: t.name, row: r })));
      if (t.role === 'link') removed.push(...rows.filter((r) => r.source_id === id).map((r) => ({ table: t.name, row: r })));
    }
    return removed;
  }

  // What still references the rows being removed, as readable lines.
  private referrers(schema: SchemaDescription, tables: Tables, removed: Located[]): string[] {
    const gone = new Set(removed.map((r) => r.row));
    const found: string[] = [];
    const recordTables = new Set<string>();
    for (const r of removed) {
      if (schema.tables[r.table].role === 'kind') {
        recordTables.add('record_id');
        for (const s of schema.kinds[r.table].supertypes) recordTables.add(s);
      }
    }
    for (const t of Object.values(schema.tables)) {
      if (!t.stored) continue;
      for (const fk of t.foreignKeys) {
        const targets = removed.filter((r) => r.table === fk.table || (recordTables.has(fk.table) && schema.tables[r.table].role === 'kind'));
        if (!targets.length) continue;
        for (const row of tables.get(t.name)?.values() ?? []) {
          if (gone.has(row)) continue;
          const hit = targets.find((target) => fk.columns.every((c, i) => row[c] !== undefined && row[c] === target.row[fk.references[i]]));
          if (!hit) continue;
          found.push(
            t.role === 'link'
              ? `${row.source_id} ${schema.relations[t.name].forwardLabel.toLowerCase()} ${row.target_id}`
              : `${t.name} ${describeKey(t, row)} (${fk.columns.join(', ')})`,
          );
        }
      }
    }
    return [...new Set(found)];
  }

  // Rewrites the files of the changed tables, each through a temporary file so a reader never sees half of one. An
  // empty table has no file.
  private async writeFiles(changed: string[]): Promise<string[]> {
    await mkdir(this.dataDir, { recursive: true });
    const written: string[] = [];
    for (const name of changed) {
      const file = path.join(this.dataDir, `${name}.jsonl`);
      const rows = [...(this.tables.get(name)?.values() ?? [])];
      const table = this.currentSchema.tables[name];
      if (!rows.length || !table) {
        if (existsSync(file)) {
          await rm(file);
          written.push(`${name}.jsonl`);
        }
        continue;
      }
      const text = tableText(table, rows);
      const display = path.join(path.basename(this.dataDir), `${name}.jsonl`);
      sortRows(table, rows).forEach((row, index) => this.origins.set(row, { file: display, line: index + 1 }));
      if (existsSync(file) && readFileSync(file, 'utf8') === text) continue;
      const temporary = `${file}.${process.pid}.tmp`;
      await writeFile(temporary, text);
      await rename(temporary, file);
      written.push(`${name}.jsonl`);
    }
    return written;
  }
}

const keyText = (key: KeyInput) => (typeof key === 'string' ? key : Object.entries(key).map(([c, v]) => `${c} ${v}`).join(', '));

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
