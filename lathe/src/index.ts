// The Lathe engine: loads a product's data/ folder through the store into the typed tables, runs the checks (rows of
// the check table, Lathe's and the product's) against them, and computes coverage from views over them.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { DuckDBConnection } from '@duckdb/node-api';
import { servesOf } from './trace/serves.ts';
import { COVERAGE_COUNTS_SQL, COVERAGE_DEBT_SQL, COVERAGE_GAPS_SQL, COVERAGE_PROOFS_SQL, COVERAGE_TESTS_SQL, OWED_PATTERN_RULES_SQL, coverageViewsSql, FACT_TABLES_SQL, TEST_KINDS, TRACE_FILES_SQL, TRACE_LINKS_SQL, TRACE_OBLIGATIONS_SQL } from './coverage.ts';
import { CONFIG_FILE, loadConfig, productClash, workspaceProducts, type LatheConfig } from './config.ts';
import { readPackageFacts } from './trace/packages.ts';
import { readTestCases } from './trace/test-cases.ts';
import { isTraced, matching, normalizePath, sourceFiles, walkFiles } from './trace/source-files.ts';
import { orderChecks, referenceOf, type Reference } from './reference.ts';
import { runCheckQuery } from './checking/check/rules.ts';
import { strictnessOfProducts, strictProblems, type ProductStrictness } from './checking/product-setting/strictness.ts';
import { formatProblem, StoreError } from './platform/data/problems.ts';
import { openStore, Store, LATHE_DATA_DIR, type StoreOptions } from './platform/data/store.ts';
import { SCHEMA_DIR } from './platform/data/schema.ts';
import { checkedKey, markValidated, readCheckedProblems, writeCheckedProblems } from './platform/data/cache.ts';
import { gatherTableFacts, TABLE_FACTS_SQL } from './trace/tables.ts';
import type { Row } from './platform/data/rows.ts';
import { gatherRouteFacts, writeRouteFacts } from './trace/routes.ts';
import type { Coverage, CoverageGap, Kind, ObligationCoverage, Problem, RelationRule, SpecLink, SpecRecord, StageRule, TestCounts, TraceChain, Workspace } from './types.ts';
import { compareIds } from './platform/data/ids.ts';

export type * from './types.ts';
export type * from './reference.ts';
export { renderReference, kindAnchor, tableAnchor, relationAnchor, stageAnchor, checkAnchor, gapAnchor, ENGINE_CHECKS } from './reference.ts';
export { ALLOWED_LEVELS, GAP_RULES, OBLIGATION_COVERAGE, type GapRule } from './coverage.ts';
export { loadConfig, readConfig, productTitles, workspaceProducts, productClash, PACKAGE_DIR, CONFIG_FILE, DEFAULT_MAX_CHILDREN, DEFAULT_SOURCE, DEFAULT_TESTS, SCHEMA_VERSION, SchemaVersionError, schemaVersionMessage, type LatheConfig } from './config.ts';
export { upgradeProduct, readConverters, UPGRADES_DIR, type Converter, type ConverterStep, type RawData, type UpgradeNotes, type UpgradeResult } from './upgrade.ts';
// The database-first store: the schema, loading data/*.jsonl, the command layer and the merge driver.
export * from './platform/data/index.ts';
export { ALL_COMMANDS, ALL_QUERIES } from './commands.ts';
export { runCommand } from './platform/commands/run.ts';

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
   * record_scope, each integrity query, each aggregate's rules, the commit), then the file facts, the coverage tables, each check (checks
   * run side by side, so theirs overlap) and the records read back. `perf/engine.ts --profile` prints them.
   */
  steps: Record<string, number>;
}

/** A record that names a file, as the checks read it (file_facts). */
interface FileFact {
  record: string;
  kind: string;
  file: string;
  /** The file as a path from the product root with forward slashes; null when it lies outside the root. */
  path: string | null;
  file_exists: boolean;
  /** Whether the file names the record's own ID as a whole ID; false when it is missing or a folder. */
  contains_id: boolean;
  /** Whether it is one of the record's helper files (helper_file) rather than its own file. */
  helper: boolean;
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
// and a product's own kinds with a file field) that gives one, and each helper file of a technical record, as one
// more row of that record. A test's file must be a file; a technical record's may also be a folder of files, and its
// helper file must be a file. Each file is read once, however many records name it, to see which of them it names.
async function gatherFileFacts(root: string, store: Store): Promise<FileFact[]> {
  const tests = new Set(TEST_KINDS);
  const named = Object.keys(store.schema.kinds)
    .filter((kind) => store.schema.tables[kind]?.columns.some((c) => c.name === 'file'))
    .flatMap((kind) => store.rows(kind).filter((row) => typeof row.file === 'string').map((row) => ({ kind, id: String(row.id), file: String(row.file), helper: false })));
  // A helper file's record is a technical record; its kind is read only when some record names a helper file.
  const helperRows = store.schema.tables.helper_file ? store.rows('helper_file') : [];
  const kindOf = new Map<string, string>();
  if (helperRows.length) {
    for (const kind of Object.values(store.schema.kinds).filter((k) => k.stage === 'technical-specification')) for (const row of store.rows(kind.name)) kindOf.set(String(row.id), kind.name);
  }
  const helpers = helperRows.map((row) => ({ kind: kindOf.get(String(row.record_id)) ?? '', id: String(row.record_id), file: String(row.file), helper: true }));
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
  return Promise.all([...named, ...helpers].map(async ({ kind, id, file, helper }): Promise<FileFact> => {
    const { type, text } = await read(resolveInside(root, file));
    const exists = type === 'file' || (type === 'folder' && !tests.has(kind) && !helper);
    const resolved = resolveInside(root, file);
    return { record: id, kind, file, path: resolved && normalizePath(path.relative(root, resolved)), file_exists: exists, contains_id: type === 'file' && mentionsId(text, id), helper };
  }));
}

/** A test case in a test file, as test-case-unnamed reads it (test_case, with the IDs it names in test_case_id). */
interface TestCaseFact {
  file: string;
  /** Its place among the file's test cases, from 1. */
  position: number;
  line: number;
  name: string;
  ids: string[];
}

// The test cases in the product's test files: the files matching the config's test globs (never in node_modules,
// dist, a dot-folder or another product's folder, one with its own lathe.config.json) and the files test records
// name, read as text (test-cases.ts says what is recognized).
async function gatherTestCases(root: string, globs: readonly string[], facts: Promise<FileFact[]>): Promise<TestCaseFact[]> {
  const skip = (folder: string, name: string) => name === 'node_modules' || name === 'dist' || name.startsWith('.') || existsSync(path.join(root, folder, CONFIG_FILE));
  const casesOf = async (file: string): Promise<TestCaseFact[]> => {
    const resolved = path.join(root, file);
    if ((await entry(resolved)) !== 'file') return [];
    return readTestCases(await readFile(resolved, 'utf8')).map((c, i): TestCaseFact => ({ file, position: i + 1, ...c }));
  };
  // The files the globs match are read while the records' files are looked at; a test file a record names that no
  // glob matches is read after.
  const matched = new Set(matching(await walkFiles(root, skip), globs));
  const read = new Map([...matched].map((file) => [file, casesOf(file)] as const));
  const tests = new Set(TEST_KINDS);
  for (const f of await facts) if (f.path !== null && f.file_exists && tests.has(f.kind) && !read.has(f.path)) read.set(f.path, casesOf(f.path));
  const files = [...read.keys()].sort();
  return (await Promise.all(files.map((file) => read.get(file)!))).flat();
}

// The product's source files, each with whether a technical record (of a technical-specification kind, Lathe's or the
// product's own) names it, as its file or a helper file, or names a folder holding it: what code-file-untraced reports
// (trace/source-files.ts).
async function gatherSourceFiles(config: Pick<LatheConfig, 'root' | 'source' | 'tests'>, store: Store): Promise<{ file: string; traced: boolean }[]> {
  const named = new Set([
    ...Object.values(store.schema.kinds)
      .filter((k) => k.stage === 'technical-specification' && store.schema.tables[k.name]?.columns.some((c) => c.name === 'file'))
      .flatMap((k) => store.rows(k.name).filter((row) => typeof row.file === 'string').map((row) => normalizePath(String(row.file)))),
    ...(store.schema.tables.helper_file ? store.rows('helper_file') : []).map((row) => normalizePath(String(row.file))),
  ]);
  return (await sourceFiles(config.root, config.source, config.tests)).map((file) => ({ file, traced: isTraced(file, named) }));
}

async function readRows<T>(connection: DuckDBConnection, sql: string): Promise<T[]> {
  return (await connection.runAndReadAll(sql)).getRowObjectsJson() as unknown as T[];
}

async function append(connection: DuckDBConnection, table: string, rows: (string | number | boolean | null)[][]) {
  const appender = await connection.createAppender(table);
  for (const row of rows) {
    for (const value of row) {
      if (value === null) appender.appendNull();
      else if (typeof value === 'boolean') appender.appendBoolean(value);
      else if (typeof value === 'number') appender.appendInteger(value);
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
      const rows = await runCheckQuery<{ severity?: string; record: string | null; message: string }>(on, String(check.query));
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
  await store.seal();
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
  // The queries only read, so they run side by side, each on its own connection.
  const on = async <T,>(sql: string) => {
    const c = await store.connect();
    try { return await readRows<T>(c, sql); } finally { c.closeSync(); }
  };
  const [counts, gaps, tests, proofs, owed, debt] = await Promise.all([
    on<Scoped<ObligationCoverage>>(COVERAGE_COUNTS_SQL),
    on<Scoped<CoverageGap>>(COVERAGE_GAPS_SQL),
    on<Scoped<TestCounts>>(COVERAGE_TESTS_SQL),
    on<Scoped<{ id: string; test_id: string }>>(COVERAGE_PROOFS_SQL),
    on<Scoped<{ id: string }>>(OWED_PATTERN_RULES_SQL),
    on<Scoped<{ id: string; slot: string }>>(COVERAGE_DEBT_SQL),
  ]);
  const key = (r: { product: string; domain: string | null }) => `${r.product}\u0000${r.domain ?? ''}`;
  const group = <T extends { product: string; domain: string | null }>(rows: T[]) => {
    const by = new Map<string, T[]>();
    for (const r of rows) by.set(key(r), [...(by.get(key(r)) ?? []), r]);
    return by;
  };
  const countsBy = group(counts);
  const gapsBy = group(gaps);
  const proofsBy = group(proofs);
  const owedBy = group(owed);
  const debtBy = group(debt);
  const provedBy = (scope: { product: string; domain: string | null }) => {
    const by: Record<string, string[]> = {};
    for (const p of proofsBy.get(key(scope)) ?? []) (by[p.id] ??= []).push(p.test_id);
    for (const ids of Object.values(by)) ids.sort(compareIds);
    return by;
  };
  return tests.map((t) => ({
    product: t.product,
    domain: t.domain,
    obligations: (countsBy.get(key(t)) ?? []).map(({ kind, label, total, designed, built, proved, not_automated, proof_only }) => ({ kind, label, total, designed, built, proved, not_automated, proof_only })),
    tests: { automated: t.automated, manual: t.manual, not_automated: t.not_automated },
    proved_by: provedBy(t),
    pattern_rules: (owedBy.get(key(t)) ?? []).map((p) => p.id),
    gaps: (gapsBy.get(key(t)) ?? []).map(({ id, kind, missing, message }) => ({ id, kind, missing, message })),
    debt: (debtBy.get(key(t)) ?? []).map(({ id, slot }) => ({ id, slot })),
  }));
}

/**
 * Every obligation's chain, from trace_link: its design, build and test records in kind order then by ID, the files
 * its build and test records name, and its links.
 */
async function computeChains(store: Store, records: SpecRecord[], order: string[]): Promise<TraceChain[]> {
  // One connection runs one query at a time; coverage's queries run on connections of their own beside these.
  const obligations = await store.query<{ id: string }>(TRACE_OBLIGATIONS_SQL);
  const links = await store.query<{ obligation_id: string; source_id: string; target_id: string; part: 'design' | 'build' | 'tests' }>(TRACE_LINKS_SQL);
  const files = await store.query<{ record: string; file: string }>(TRACE_FILES_SQL);
  const kindOf = new Map(records.map((r) => [r.id, r.kind]));
  const rank = new Map(order.map((k, i) => [k, i]));
  const of = (id: string) => rank.get(kindOf.get(id) ?? '') ?? rank.size;
  const sorted = (ids: Iterable<string>) => [...new Set(ids)].sort((a, b) => of(a) - of(b) || compareIds(a, b));
  // A record's own file and its helper files, each with the record that names it.
  const filesOf = new Map<string, string[]>();
  for (const f of files) filesOf.set(f.record, [...(filesOf.get(f.record) ?? []), f.file]);
  const by = new Map<string, typeof links>();
  for (const l of links) by.set(l.obligation_id, [...(by.get(l.obligation_id) ?? []), l]);
  return obligations.map(({ id }) => {
    const own = by.get(id) ?? [];
    const part = (p: 'design' | 'build' | 'tests') => sorted(own.filter((l) => l.part === p).map((l) => l.target_id));
    const [design, build, tests] = [part('design'), part('build'), part('tests')];
    const named = new Map<string, string[]>();
    for (const r of [...build, ...tests]) {
      for (const file of filesOf.get(r) ?? []) named.set(file, [...(named.get(file) ?? []), r]);
    }
    return {
      obligation: id,
      design,
      build,
      tests,
      files: [...named].map(([path, named_by]) => ({ path, named_by })).sort((a, b) => a.path.localeCompare(b.path)),
      links: own.map((l) => [l.source_id, l.target_id] as [string, string]),
    };
  });
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
      complexity: k.complexity,
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

/**
 * The workspace of an open store: its records and links, every check's problems, coverage and chains. The config's root resolves the files records name; its source and test globs find the source files.
 */
export async function readWorkspace(store: Store, config: Pick<LatheConfig, 'root' | 'source' | 'tests' | 'routers' | 'packages'>, timings?: Partial<LoadTimings>): Promise<Workspace> {
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
  const root = path.resolve(config.root);
  // The files records name, the source files and the routes they serve are read side by side, and beside them the
  // data's database is built (the checks and coverage run SQL over it): the files are read from the rows alone.
  const gathered = (async () => {
    const facts = step('file facts', () => gatherFileFacts(root, store));
    // Awaited below, and by the test cases; a refusal is handled there, not when it happens.
    facts.catch(() => undefined);
    const [sources, routes, cases] = await Promise.all([
      step('source files', () => gatherSourceFiles({ ...config, root }, store)),
      step('route facts', () => gatherRouteFacts({ ...config, root }, store)),
      step('test cases', () => gatherTestCases(root, config.tests, facts)),
    ]);
    const packages = await step('package facts', async () => readPackageFacts(root, config.packages));
    return { facts: await facts, sources, routes, packages, cases };
  })();
  // Awaited below, after the database; a refusal (such as a config that names no package) is thrown there.
  gathered.catch(() => undefined);
  await step('database', () => store.ensureDatabase());
  const order = await kindOrder(store);
  const read = await step('read records', () => readRecords(store, order));
  const { facts, sources, routes, packages, cases } = await gathered;
  const connection = store.connection;
  await connection.run(FACT_TABLES_SQL);
  await append(connection, 'file_facts', facts.map((f) => [f.record, f.kind, f.file, f.path, f.file_exists, f.contains_id, f.helper]));
  await append(connection, 'source_file', sources.map((f) => [f.file, f.traced]));
  const served = await step('serves', async () => servesOf({ schema: store.schema, rows: (table) => store.rows(table) }));
  await append(connection, 'record_serves', [...served].flatMap(([record, s]) => s.outcomes.map((outcome) => [record, outcome])));
  await append(connection, 'test_case', cases.map((c) => [c.file, c.position, c.line, c.name]));
  await append(connection, 'test_case_id', cases.flatMap((c) => c.ids.map((id) => [c.file, c.position, id])));
  await writeRouteFacts(connection, routes);
  await append(connection, 'package_facts', packages.map((p) => [p.manifest, p.package]));
  const tableFacts = await step('table facts', () => gatherTableFacts(path.resolve(config.root), store));
  await connection.run(TABLE_FACTS_SQL);
  await append(connection, 'table_facts', tableFacts.map((f) => [f.record, f.name, f.file, f.part, f.expected, f.found]));
  await step('coverage tables', () => connection.run(coverageViewsSql(store.schema)));
  lap('files');
  const scope = new Map(read.records.map((r) => [r.id, r.product]));
  const checked = await runChecks(store, orderChecks(store.rows('check')), scope, steps);
  // A strict product's warnings fail its check (strictness.ts), counted over every other check's problems.
  const problems = [...checked, ...strictProblems(store.rows('product_setting'), checked, (record) => scope.get(record))];
  lap('checks');
  const [coverage, chains] = await Promise.all([computeCoverage(store), computeChains(store, read.records, order)]);
  lap('coverage');
  return { ...read, problems, coverage, chains };
}

// The problems of the last runs, kept by the key of the data and config they ran on (checkedKey): in this process's
// memory (the MCP server's, the app server's), and in the cache folder for the next process (cache.ts). A write runs
// the checks once, after it, and reads the run before it from here.
const keptProblems = new Map<string, readonly Problem[]>();
const KEPT_IN_MEMORY = 8;

const runKey = async (store: Store, config: Pick<LatheConfig, 'root' | 'source' | 'tests' | 'routers' | 'packages'>) => checkedKey(await store.contentKey(), JSON.stringify(config));

function keepProblems(key: string, problems: readonly Problem[], write: boolean): void {
  keptProblems.delete(key);
  keptProblems.set(key, problems);
  if (keptProblems.size > KEPT_IN_MEMORY) keptProblems.delete(keptProblems.keys().next().value!);
  if (write) writeCheckedProblems(key, problems);
}

/**
 * The problems the checks find in the store's data as its files hold it now: the ones kept for exactly this data and
 * config (in memory, or in the cache from another process), or a run of the checks, then kept. Source and test files
 * are not in the key: a run kept before a code change answers for the same data after it.
 */
export async function checkedProblems(store: Store, config: Pick<LatheConfig, 'root' | 'source' | 'tests' | 'routers' | 'packages'>): Promise<readonly Problem[]> {
  const content = await store.contentKey();
  const key = checkedKey(content, JSON.stringify(config));
  const memory = keptProblems.get(key);
  if (memory) return memory;
  const cached = readCheckedProblems<Problem>(key);
  if (cached) {
    keepProblems(key, cached, false);
    return cached;
  }
  const { problems } = await readWorkspace(store, config);
  keepProblems(key, problems, true);
  // The run built the data whole and it passed, as a load's whole build does: the next load of these files reads them
  // without building them again (the validated-build stamp is keyed as the content is).
  markValidated(content);
  return problems;
}

/** A workspace whose data did not load: no records, and the store's refusals as data-refused errors. */
function refusedWorkspace(error: StoreError): Workspace {
  return {
    kinds: [], stages: [], relations: [], records: [], links: [], coverage: [], chains: [],
    problems: error.problems.map((p) => ({ severity: 'error', check: 'data-refused', record: p.key && /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/.test(p.key) ? p.key : null, message: formatProblem(p) })),
  };
}

/** Loads, checks and measures the product under root (the repo root), from its data/ folder. */
export async function loadWorkspace(root: string, options: LoadOptions = {}): Promise<Workspace> {
  return (await loadChecked(root, options)).workspace;
}

/** The product's workspace, with the strictness of each product its data holds, as its check judged it. */
async function loadChecked(root: string, options: LoadOptions): Promise<{ workspace: Workspace; strictness: ProductStrictness[] }> {
  const config = loadConfig(root);
  const started = performance.now();
  const timings = options.timings;
  let store: Store;
  try {
    store = await openStore(config.root, { ...storeOptions(options), ...(timings ? { steps: (timings.steps ??= {}) } : {}) });
  } catch (error) {
    if (error instanceof StoreError) return { workspace: refusedWorkspace(error), strictness: [] };
    throw error;
  }
  // The checks run SQL, so the database is built here, where the open is timed (a load of validated files skips it).
  await store.ensureDatabase().catch(async (error) => {
    await store.close();
    throw error;
  });
  if (timings) timings.open = Math.round((performance.now() - started) * 10) / 10;
  try {
    const workspace = await readWorkspace(store, config, timings);
    // The run is kept, so the next write on this data reads it instead of running the checks again.
    keepProblems(await runKey(store, config), workspace.problems, true);
    return { workspace, strictness: strictnessOfProducts(store.rows('product_setting'), workspace) };
  } finally {
    await store.close();
    if (timings) timings.total = Math.round((performance.now() - started) * 10) / 10;
  }
}

/** One product of a workspace: its config (its root, data folder, globs), its loaded, checked workspace, and the strictness of each product its data holds. */
export interface ProductWorkspace {
  config: LatheConfig;
  workspace: Workspace;
  strictness: ProductStrictness[];
}

/**
 * Loads, checks and measures every product the workspace under root shows: its own, then each its config's products
 * key lists, each from its own folder with its own config, checks, tracing and coverage. A product ID found in two
 * products' folders stops the load.
 */
export async function loadProducts(root: string, options: Pick<LoadOptions, 'latheDataDir'> = {}): Promise<ProductWorkspace[]> {
  const configs = workspaceProducts(root);
  const loaded: ProductWorkspace[] = [];
  for (const config of configs) loaded.push({ config, ...(await loadChecked(config.root, options)) });
  const clash = productClash(configs[0].root, loaded.map(({ config, workspace }) => ({ root: config.root, ids: workspace.records.filter((r) => r.kind === 'product').map((r) => r.id) })));
  if (clash) throw new Error(clash);
  return loaded;
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
