// The Lathe engine: loads a product's data/ folder through the store into the typed tables, runs the checks (rows of
// the check table, Lathe's and the product's) against them, and computes coverage from views over them.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { DuckDBConnection } from '@duckdb/node-api';
import { COVERAGE_COUNTS_SQL, COVERAGE_GAPS_SQL, COVERAGE_TESTS_SQL, coverageViewsSql, FACT_TABLES_SQL, TEST_KINDS } from './coverage.ts';
import { loadConfig } from './config.ts';
import { orderChecks, referenceOf, type Reference } from './reference.ts';
import { formatProblem, openStore, Store, StoreError, LATHE_DATA_DIR, type StoreOptions } from './store/store.ts';
import { SCHEMA_DIR } from './store/schema.ts';
import type { Row } from './store/rows.ts';
import type { Coverage, CoverageGap, Kind, ObligationCoverage, Problem, RecordedException, RelationRule, SpecLink, SpecRecord, StageRule, TestCounts, Workspace } from './types.ts';

export type * from './types.ts';
export type * from './reference.ts';
export { renderReference, kindAnchor, tableAnchor, relationAnchor, stageAnchor, checkAnchor, gapAnchor, ENGINE_CHECKS } from './reference.ts';
export { ALLOWED_LEVELS, GAP_RULES, OBLIGATION_COVERAGE, type GapRule } from './coverage.ts';
export { loadConfig, PACKAGE_DIR, CONFIG_FILE, DEFAULT_MAX_CHILDREN, type LatheConfig } from './config.ts';
// The database-first store: the schema, loading data/*.jsonl, the command layer and the merge driver.
export * from './store/index.ts';

export interface LoadOptions {
  /** The data folder, in place of the one lathe.config.json names. */
  dataDir?: string;
  /** Lathe's own data folder with the built-in checks, in place of the package's (null: none, used by tests). */
  latheDataDir?: string | null;
  /** Filled with how long each phase of the load took, in milliseconds (the performance budgets, LA-PLT-UC01-R03). */
  timings?: Partial<LoadTimings>;
}

/** How long each phase of loadWorkspace took, in milliseconds. */
export interface LoadTimings {
  /** Opening the store: reading the data files and loading them into the typed tables with every key and rule. */
  open: number;
  /** The facts about the files records name (a technical record's file, a test's file). */
  files: number;
  /** Running Lathe's checks and the product's. */
  checks: number;
  /** Coverage per domain, and the records and links read back. */
  coverage: number;
  /** The whole load. */
  total: number;
  /**
   * The steps inside the phases, by name: the store's (reading the files, the schema, each table's insert,
   * record_scope, each validation query, the commit), then the file facts, the coverage tables, each check (checks
   * run side by side, so theirs overlap) and the records read back. `perf/engine.ts --profile` prints them.
   */
  steps: Record<string, number>;
}

/** A record that names a file, as the checks read it (file_facts). */
interface FileFact {
  record: string;
  kind: string;
  file: string;
  file_exists: boolean;
  /** Whether the file names the record's own ID as a whole ID; false when it is missing or a folder. */
  contains_id: boolean;
}

// Resolves a path named in a record, refusing anything outside root.
function resolveInside(root: string, file: string): string | null {
  const resolved = path.resolve(root, file);
  const rel = path.relative(root, resolved);
  return rel.startsWith('..') || path.isAbsolute(rel) ? null : resolved;
}

// What a path is: a file, a folder, or nothing (missing, or outside the root).
async function entry(file: string | null): Promise<'file' | 'folder' | null> {
  if (!file) return null;
  try {
    const info = await stat(file);
    return info.isFile() ? 'file' : info.isDirectory() ? 'folder' : null;
  } catch {
    return null;
  }
}

// True if the text names the ID as a whole ID: TL-LEND-INV05 is not found in TL-LEND-INV050 or TL-LEND-INV05-T.
function mentionsId(content: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9-])${escaped}(?![A-Za-z0-9]|-[A-Za-z0-9])`).test(content);
}

// Facts about the files records name: every record of a kind with a file column (the technical kinds, the test kinds,
// and a product's own kinds with a file field) that gives one. A test's file must be a file; a technical record's may
// also be a folder of files. Each file is read once, however many records name it, to see which of them it names.
async function gatherFileFacts(root: string, store: Store): Promise<FileFact[]> {
  const tests = new Set(TEST_KINDS);
  const named = Object.keys(store.schema.kinds)
    .filter((kind) => store.schema.tables[kind]?.columns.some((c) => c.name === 'file'))
    .flatMap((kind) => store.rows(kind).filter((row) => typeof row.file === 'string').map((row) => ({ kind, id: String(row.id), file: String(row.file) })));
  const contents = new Map<string, Promise<{ type: 'file' | 'folder' | null; text: string }>>();
  const read = (resolved: string | null) => {
    const key = resolved ?? '';
    let known = contents.get(key);
    if (!known) {
      known = (async () => {
        const type = await entry(resolved);
        return { type, text: type === 'file' && resolved ? await readFile(resolved, 'utf8') : '' };
      })();
      contents.set(key, known);
    }
    return known;
  };
  return Promise.all(named.map(async ({ kind, id, file }): Promise<FileFact> => {
    const { type, text } = await read(resolveInside(root, file));
    const exists = type === 'file' || (type === 'folder' && !tests.has(kind));
    return { record: id, kind, file, file_exists: exists, contains_id: type === 'file' && mentionsId(text, id) };
  }));
}

async function readRows<T>(connection: DuckDBConnection, sql: string): Promise<T[]> {
  return (await connection.runAndReadAll(sql)).getRowObjectsJson() as unknown as T[];
}

async function append(connection: DuckDBConnection, table: string, rows: (string | boolean | null)[][]) {
  const appender = await connection.createAppender(table);
  for (const row of rows) {
    for (const value of row) {
      if (value === null) appender.appendNull();
      else if (typeof value === 'boolean') appender.appendBoolean(value);
      else appender.appendVarchar(value);
    }
    appender.endRow();
  }
  appender.closeSync();
}

/** How many checks run at once, each on its own connection to the same data. */
const CHECK_CONNECTIONS = 4;

// Runs the check rows and returns their problems in run order. A check's query returns (severity, record, message)
// for each problem; severity may be left out when the check's own severity is error or warning. A query that fails is
// one error under the check's name. A product's check reports only on records of its product (and on none). Checks
// only read the tables, so they run side by side on a few connections; their problems keep run order.
async function runChecks(store: Store, checks: Row[], scope: Map<string, string | null>, steps?: Record<string, number>): Promise<Problem[]> {
  const runOne = async (on: DuckDBConnection, check: Row): Promise<Problem[]> => {
    const name = String(check.name);
    const fixed = check.severity === 'error_or_warning' ? null : (check.severity as 'error' | 'warning');
    try {
      const start = performance.now();
      const rows = await readRows<{ severity?: string; record: string | null; message: string }>(on, String(check.query));
      if (steps) steps[`check ${name}`] = Math.round((performance.now() - start) * 10) / 10;
      const product = check.product_id === undefined ? null : String(check.product_id);
      return rows
        .map((row): Problem => ({
          severity: row.severity === 'warning' || row.severity === 'error' ? row.severity : (fixed ?? 'error'),
          check: name,
          record: row.record === null || row.record === undefined || row.record === '' ? null : String(row.record),
          message: String(row.message),
        }))
        .filter((p) => product === null || p.record === null || scope.get(p.record) === product);
    } catch (error) {
      return [{ severity: 'error', check: name, record: null, message: `The check ${name} could not run: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}` }];
    }
  };
  if (checks.length === 0) return [];
  const results: Problem[][] = new Array(checks.length);
  const extra = await Promise.all(Array.from({ length: Math.min(CHECK_CONNECTIONS, checks.length) - 1 }, () => store.connect()));
  const connections = [store.connection, ...extra];
  let next = 0;
  try {
    await Promise.all(connections.map(async (on) => {
      while (next < checks.length) {
        const at = next++;
        results[at] = await runOne(on, checks[at]);
      }
    }));
  } finally {
    for (const c of extra) c.closeSync();
  }
  return results.flat();
}

type Scoped<T> = T & { product: string; domain: string | null };

// Coverage per domain, and per product outside every domain: one entry per obligation kind in kind order, the tests
// by state, and the gaps.
async function computeCoverage(store: Store): Promise<Coverage[]> {
  // The three queries only read, so they run side by side, each on its own connection.
  const on = async <T,>(sql: string) => {
    const c = await store.connect();
    try { return await readRows<T>(c, sql); } finally { c.closeSync(); }
  };
  const [counts, gaps, tests] = await Promise.all([
    on<Scoped<ObligationCoverage>>(COVERAGE_COUNTS_SQL),
    on<Scoped<CoverageGap>>(COVERAGE_GAPS_SQL),
    on<Scoped<TestCounts>>(COVERAGE_TESTS_SQL),
  ]);
  const key = (r: { product: string; domain: string | null }) => `${r.product}\u0000${r.domain ?? ''}`;
  const group = <T extends { product: string; domain: string | null }>(rows: T[]) => {
    const by = new Map<string, T[]>();
    for (const r of rows) by.set(key(r), [...(by.get(key(r)) ?? []), r]);
    return by;
  };
  const countsBy = group(counts);
  const gapsBy = group(gaps);
  return tests.map((t) => ({
    product: t.product,
    domain: t.domain,
    obligations: (countsBy.get(key(t)) ?? []).map(({ kind, label, total, designed, built, proved, not_automated, proof_only }) => ({ kind, label, total, designed, built, proved, not_automated, proof_only })),
    tests: { automated: t.automated, manual: t.manual, not_automated: t.not_automated },
    gaps: (gapsBy.get(key(t)) ?? []).map(({ id, kind, missing, message }) => ({ id, kind, missing, message })),
  }));
}

/** The kinds in the order people read them: Lathe's by meta_kind.position, then the product's by name. */
async function kindOrder(store: Store): Promise<string[]> {
  return (await store.query<{ name: string }>('SELECT name FROM meta_kind ORDER BY position NULLS LAST, name')).map((k) => k.name);
}

/** The records, links and meta-model of an open store, as the engine returns them. */
async function readRecords(store: Store, order: string[]): Promise<{ kinds: Kind[]; stages: StageRule[]; relations: RelationRule[]; records: SpecRecord[]; links: SpecLink[] }> {
  const schema = store.schema;
  const kinds: Kind[] = order.map((name) => {
    const k = schema.kinds[name];
    const parentColumns = new Set(k.parents.map((p) => p.column));
    return {
      kind: name,
      label: k.label,
      stage: k.stage,
      position: k.position,
      parent_kinds: k.parents.map((p) => p.kind),
      required_fields: schema.tables[name].columns.filter((c) => c.required && c.name !== 'id' && c.name !== 'title' && !parentColumns.has(c.name)).map((c) => c.name),
      obligation: k.obligation,
      id_scope: k.idScope,
      description: k.description ?? '',
    };
  });
  const stages: StageRule[] = schema.stages.map((s) => ({ stage: s.name, position: s.position, label: s.label, description: s.description }));
  const relations: RelationRule[] = Object.values(schema.relations).flatMap((r) =>
    r.pairs.map((p) => ({ relation: r.name, source_kind: p.source, target_kind: p.target, role: r.role ?? '', description: p.description, forward_label: r.forwardLabel, reverse_label: r.reverseLabel })),
  );

  // Each record's product, domain and aggregate come from the store's record_scope view: through its parents, or for
  // a record with no owner from its ID.
  const scopes = new Map(
    (await store.query<{ id: string; product_id: string | null; domain_id: string | null; aggregate_id: string | null }>('SELECT id, product_id, domain_id, aggregate_id FROM record_scope')).map((s) => [s.id, s]),
  );
  const parts = new Map<string, Record<string, Row[]>>();
  for (const table of Object.values(schema.tables)) {
    if (table.role !== 'part' || !table.ownerColumn) continue;
    for (const row of store.rows(table.name)) {
      const owner = String(row[table.ownerColumn]);
      const of = parts.get(owner) ?? {};
      (of[table.name] ??= []).push(row);
      parts.set(owner, of);
    }
  }
  const records: SpecRecord[] = order.flatMap((kind) =>
    store.rows(kind).map((row) => {
      const parent = schema.kinds[kind].parents.map((p) => row[p.column]).find((v) => v !== undefined);
      const { id, title, ...fields } = row;
      const scope = scopes.get(String(id));
      return {
        id: String(id),
        kind,
        title: String(title),
        parent: parent === undefined ? null : String(parent),
        product: scope?.product_id ?? null,
        domain: scope?.domain_id ?? null,
        aggregate: scope?.aggregate_id ?? null,
        fields: fields as Row,
        parts: parts.get(String(id)) ?? {},
      };
    }),
  );
  const links: SpecLink[] = Object.keys(schema.relations)
    .sort()
    .flatMap((relation) => store.rows(relation).map((l) => ({ source: String(l.source_id), relation, target: String(l.target_id) })));
  return { kinds, stages, relations, records, links };
}

/** The recorded exceptions as lathe check prints them: a heading with their count, then one line each. */
export function exceptionsText(exceptions: RecordedException[]): string {
  const line = (e: RecordedException) => `  ${e.command} also changes aggregate ${e.aggregate} in the same transaction: ${e.reason}`;
  return `Recorded exceptions (${exceptions.length}):\n${exceptions.map(line).join('\n')}`;
}

/** Every recorded exception (command_change), by command and aggregate. */
export function recordedExceptions(store: Store): RecordedException[] {
  return store.rows('command_change').map((r) => ({ command: String(r.command_id), aggregate: String(r.aggregate_id), reason: String(r.reason) }));
}

/** The workspace of an open store: its records and links, every check's problems, the recorded exceptions, and coverage. root resolves the files records name. */
export async function readWorkspace(store: Store, root: string, timings?: Partial<LoadTimings>): Promise<Workspace> {
  let mark = performance.now();
  const lap = (phase: 'files' | 'checks' | 'coverage') => {
    const now = performance.now();
    if (timings) timings[phase] = Math.round((now - mark) * 10) / 10;
    mark = now;
  };
  const steps = timings ? (timings.steps ??= {}) : undefined;
  const step = async <T,>(name: string, run: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    try {
      return await run();
    } finally {
      if (steps) steps[name] = Math.round((performance.now() - start) * 10) / 10;
    }
  };
  const order = await kindOrder(store);
  const read = await step('read records', () => readRecords(store, order));
  const facts = await step('file facts', () => gatherFileFacts(path.resolve(root), store));
  const connection = store.connection;
  await connection.run(FACT_TABLES_SQL);
  await append(connection, 'file_facts', facts.map((f) => [f.record, f.kind, f.file, f.file_exists, f.contains_id]));
  await step('coverage tables', () => connection.run(coverageViewsSql(store.schema)));
  lap('files');
  const scope = new Map(read.records.map((r) => [r.id, r.product]));
  const problems = await runChecks(store, orderChecks(store.rows('check')), scope, steps);
  lap('checks');
  const coverage = await computeCoverage(store);
  lap('coverage');
  return { ...read, problems, exceptions: recordedExceptions(store), coverage };
}

/** A workspace whose data did not load: no records, and the store's refusals as data-refused errors. */
function refusedWorkspace(error: StoreError): Workspace {
  return {
    kinds: [], stages: [], relations: [], records: [], links: [], exceptions: [], coverage: [],
    problems: error.problems.map((p) => ({ severity: 'error', check: 'data-refused', record: p.key && /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/.test(p.key) ? p.key : null, message: formatProblem(p) })),
  };
}

/** Loads, checks and measures the product under root (the repo root), from its data/ folder. */
export async function loadWorkspace(root: string, options: LoadOptions = {}): Promise<Workspace> {
  const config = loadConfig(root);
  const started = performance.now();
  const timings = options.timings;
  let store: Store;
  try {
    store = await openStore(config.root, { ...storeOptions(options), ...(timings ? { steps: (timings.steps ??= {}) } : {}) });
  } catch (error) {
    if (error instanceof StoreError) return refusedWorkspace(error);
    throw error;
  }
  if (timings) timings.open = Math.round((performance.now() - started) * 10) / 10;
  try {
    return await readWorkspace(store, config.root, timings);
  } finally {
    await store.close();
    if (timings) timings.total = Math.round((performance.now() - started) * 10) / 10;
  }
}

const storeOptions = (options: LoadOptions): StoreOptions => ({
  ...(options.dataDir === undefined ? {} : { dataDir: options.dataDir }),
  ...(options.latheDataDir === undefined ? {} : { latheDataDir: options.latheDataDir }),
});

/**
 * The reference for the product under root: its stages, kinds, tables and relations, with its own kinds and
 * relations, every check (Lathe's, the engine's own, then the product's) and the coverage gaps. While no data file or
 * migration changes (by size and modification time, or a file coming or going), the last answer stands.
 */
export async function buildReference(root: string, options: LoadOptions = {}): Promise<Reference> {
  const config = loadConfig(root);
  const dataDir = path.resolve(options.dataDir ?? config.dataDir);
  const latheDir = options.latheDataDir === undefined ? LATHE_DATA_DIR : options.latheDataDir;
  const key = referenceKey([dataDir, ...(latheDir ? [latheDir] : []), SCHEMA_DIR]);
  const known = referenceCache.get(key);
  if (known) return known;
  const store = await openStore(config.root, storeOptions(options));
  try {
    const reference = referenceOf(store.schema, await kindOrder(store), store.rows('check'));
    if (referenceCache.size > 16) referenceCache.clear();
    referenceCache.set(key, reference);
    return reference;
  } finally {
    await store.close();
  }
}

const referenceCache = new Map<string, Reference>();

/** What the reference depends on, as one string: each file in those folders with its size and modification time. */
function referenceKey(dirs: string[]): string {
  const parts: string[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) { parts.push(`${dir} (missing)`); continue; }
    for (const name of readdirSync(dir).sort()) {
      const info = statSync(path.join(dir, name));
      parts.push(`${path.join(dir, name)}:${info.size}:${info.mtimeMs}`);
    }
  }
  return parts.join('\n');
}
