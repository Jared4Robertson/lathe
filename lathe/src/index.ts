// The Lathe engine: loads a product's data/ folder through the store into the typed tables, runs the checks (rows of
// the check table, Lathe's and the product's) against them, and computes traceability coverage from views over them.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { DuckDBConnection } from '@duckdb/node-api';
import { COVERAGE_COUNTS_SQL, COVERAGE_GAPS_SQL, COVERAGE_TESTS_SQL, COVERAGE_VIEWS_SQL, FACT_TABLES_SQL } from './coverage.ts';
import { loadConfig } from './config.ts';
import { orderChecks, referenceOf, type Reference } from './reference.ts';
import { formatProblem, openStore, Store, StoreError, LATHE_DATA_DIR, type StoreOptions } from './store/store.ts';
import { SCHEMA_DIR } from './store/schema.ts';
import type { Row } from './store/rows.ts';
import type { Coverage, CoverageGap, Kind, ObligationCoverage, Problem, RelationRule, SectionRule, SpecLink, SpecRecord, TestCounts, Workspace } from './types.ts';

export type * from './types.ts';
export type * from './reference.ts';
export { renderReference, kindAnchor, tableAnchor, relationAnchor, sectionAnchor, checkAnchor, ENGINE_CHECKS } from './reference.ts';
export { loadConfig, PACKAGE_DIR, CONFIG_FILE, DEFAULT_MAX_CHILDREN, type LatheConfig } from './config.ts';
// The database-first store: the schema, loading data/*.jsonl, the command layer and the merge driver.
export * from './store/index.ts';

export interface LoadOptions {
  /** The data folder, in place of the one lathe.config.json names. */
  dataDir?: string;
  /** Lathe's own data folder with the built-in checks, in place of the package's (null: none, used by tests). */
  latheDataDir?: string | null;
  /** Filled with how long each phase of the load took, in milliseconds (the performance budgets, LA-PLT-DR02). */
  timings?: Partial<LoadTimings>;
}

/** How long each phase of loadWorkspace took, in milliseconds. */
export interface LoadTimings {
  /** Opening the store: reading the data files and loading them into the typed tables with every key and rule. */
  open: number;
  /** The facts about the files records name (a test's file, a component's file). */
  files: number;
  /** Running Lathe's checks and the product's. */
  checks: number;
  /** Coverage per domain, and the records and links read back. */
  coverage: number;
  /** The whole load. */
  total: number;
}

/** A link of a test's or component's file, as the checks read it. */
interface FileFact {
  record: string;
  kind: string;
  file: string;
  file_exists: boolean;
  /** For a test: whether the file names the test's own ID, or its key when it has one. Null for a component. */
  contains_id: boolean | null;
  /** A test's key_file, the file that holds its key when it runs from a shared class in another file, or null. */
  key_file: string | null;
  /** Whether the key_file sits under the product root; null when the test has none. */
  key_file_inside: boolean | null;
  /** Whether the key_file exists as a file under the product root; null when the test has none. */
  key_file_exists: boolean | null;
}

// Resolves a path named in a record, refusing anything outside root.
function resolveInside(root: string, file: string): string | null {
  const resolved = path.resolve(root, file);
  const rel = path.relative(root, resolved);
  return rel.startsWith('..') || path.isAbsolute(rel) ? null : resolved;
}

// A test's file must be a file; a component's file may also be a folder of files.
async function exists(file: string | null, allowFolder: boolean): Promise<boolean> {
  if (!file) return false;
  try {
    const info = await stat(file);
    return info.isFile() || (allowFolder && info.isDirectory());
  } catch {
    return false;
  }
}

// True if the text names the ID as a whole ID: TL-LEND-DR05 is not found in TL-LEND-DR050 or TL-LEND-DR05-R01.
function mentionsId(content: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9-])${escaped}(?![A-Za-z0-9]|-[A-Za-z0-9])`).test(content);
}

// Facts about the files records name: a test's file and a component's file. For a test, contains_id says whether the
// file names the test's own ID or, when the test has a `key`, whether the file contains that key text instead. Also
// which IDs the file mentions (its own and its link targets), so a check can accept a test whose file names every ID
// it proves. A test that runs from a shared class in another file names that file in `key_file`: its key, own ID and
// proved IDs are then looked for in the key file instead, and its `file` must still exist. A key file outside the
// root, or missing, contains nothing.
async function gatherFileFacts(root: string, store: Store, targets: Map<string, string[]>): Promise<{ facts: FileFact[]; mentions: { record: string; mentioned: string }[] }> {
  const named = [
    ...store.rows('test').map((row) => ({ kind: 'test', row })),
    ...store.rows('component').map((row) => ({ kind: 'component', row })),
  ].filter(({ row }) => typeof row.file === 'string');
  const each = await Promise.all(named.map(async ({ kind, row }) => {
    const id = String(row.id);
    const file = String(row.file);
    const resolved = resolveInside(root, file);
    const found = await exists(resolved, kind === 'component');
    const mentions: { record: string; mentioned: string }[] = [];
    let containsId: boolean | null = null;
    const keyFile = kind === 'test' && typeof row.key_file === 'string' ? row.key_file : null;
    const keyResolved = keyFile ? resolveInside(root, keyFile) : null;
    const keyFound = keyFile ? await exists(keyResolved, false) : null;
    if (kind === 'test') {
      const source = keyFile ? (keyFound ? keyResolved : null) : found ? resolved : null;
      const content = source ? await readFile(source, 'utf8') : '';
      const key = typeof row.key === 'string' ? row.key : undefined;
      containsId = key ? content.includes(key) : mentionsId(content, id);
      for (const candidate of new Set([id, ...(targets.get(id) ?? [])])) if (mentionsId(content, candidate)) mentions.push({ record: id, mentioned: candidate });
    }
    const fact: FileFact = {
      record: id, kind, file, file_exists: found, contains_id: containsId,
      key_file: keyFile, key_file_inside: keyFile ? keyResolved !== null : null, key_file_exists: keyFound,
    };
    return { fact, mentions };
  }));
  return { facts: each.map((e) => e.fact), mentions: each.flatMap((e) => e.mentions) };
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
async function runChecks(store: Store, checks: Row[], scope: Map<string, string | null>): Promise<Problem[]> {
  const runOne = async (on: DuckDBConnection, check: Row): Promise<Problem[]> => {
    const name = String(check.name);
    const fixed = check.severity === 'error_or_warning' ? null : (check.severity as 'error' | 'warning');
    try {
      const rows = await readRows<{ severity?: string; record: string | null; message: string }>(on, String(check.query));
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

// Coverage per domain: one entry per obligation kind in schema order, and the domain's tests by state.
async function computeCoverage(store: Store): Promise<Coverage[]> {
  // The three queries only read, so they run side by side, each on its own connection.
  const on = async <T,>(sql: string) => {
    const c = await store.connect();
    try { return await readRows<T>(c, sql); } finally { c.closeSync(); }
  };
  const [rows, gaps, tests] = await Promise.all([
    on<ObligationCoverage & { domain: string }>(COVERAGE_COUNTS_SQL),
    on<CoverageGap & { domain: string }>(COVERAGE_GAPS_SQL),
    on<TestCounts & { domain: string }>(COVERAGE_TESTS_SQL),
  ]);
  return store.rows('domain').map((d) => {
    const domain = String(d.id);
    const t = tests.find((x) => x.domain === domain) ?? { automated: 0, manual: 0, planned: 0 };
    return {
      domain,
      obligations: rows.filter((r) => r.domain === domain).map(({ domain: _domain, ...o }) => o),
      tests: { automated: t.automated, manual: t.manual, planned: t.planned },
      gaps: gaps.filter((g) => g.domain === domain).map(({ id, kind, missing }) => ({ id, kind, missing })),
    };
  });
}

/** The kinds in schema order (Lathe's by migration, then the product's), from meta_kind. */
async function kindOrder(store: Store): Promise<string[]> {
  return (await store.query<{ name: string }>('SELECT name FROM meta_kind ORDER BY rowid')).map((k) => k.name);
}

/** The records, links and meta-model of an open store, as the engine returns them. */
function readRecords(store: Store, order: string[]): { kinds: Kind[]; sections: SectionRule[]; relations: RelationRule[]; records: SpecRecord[]; links: SpecLink[] } {
  const schema = store.schema;
  const kinds: Kind[] = order.map((name) => {
    const k = schema.kinds[name];
    const parentColumns = new Set(k.parents.map((p) => p.column));
    return {
      kind: name,
      label: k.label,
      stage: k.stage ?? '',
      section: k.section ?? '',
      parent_kinds: k.parents.map((p) => p.kind),
      required_fields: schema.tables[name].columns.filter((c) => c.required && c.name !== 'id' && c.name !== 'title' && !parentColumns.has(c.name)).map((c) => c.name),
      obligation: k.obligation !== 'none',
      proof_only: k.obligation === 'proof',
      description: k.description ?? '',
    };
  });
  const sections: SectionRule[] = schema.sections.map((s) => ({ section: s.name, stage: s.stage ?? '', order: s.position, label: s.label, description: s.description }));
  const relations: RelationRule[] = Object.values(schema.relations).flatMap((r) =>
    r.pairs.map((p) => ({ relation: r.name, source_kind: p.source, target_kind: p.target, role: r.role ?? '', description: p.description, forward_label: r.forwardLabel, reverse_label: r.reverseLabel })),
  );

  // Each record's parent is the first of its parent columns with a value; its product and domain come from its ancestry.
  const base = order.flatMap((kind) =>
    store.rows(kind).map((row) => {
      const parent = schema.kinds[kind].parents.map((p) => row[p.column]).find((v) => v !== undefined);
      const { id, title, ...fields } = row;
      return { id: String(id), kind, title: String(title), parent: parent === undefined ? null : String(parent), fields: fields as Row };
    }),
  );
  const byId = new Map(base.map((r) => [r.id, r]));
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
  const above = (id: string, kind: string): string | null => {
    for (let at = byId.get(id), steps = 0; at && steps < 64; at = at.parent ? byId.get(at.parent) : undefined, steps++) if (at.kind === kind) return at.id;
    return null;
  };
  const records: SpecRecord[] = base.map((r) => ({ ...r, product: above(r.id, 'product'), domain: above(r.id, 'domain'), parts: parts.get(r.id) ?? {} }));
  const links: SpecLink[] = Object.keys(schema.relations)
    .sort()
    .flatMap((relation) => store.rows(relation).map((l) => ({ source: String(l.source_id), relation, target: String(l.target_id) })));
  return { kinds, sections, relations, records, links };
}

/** The workspace of an open store: its records and links, every check's problems, and coverage. root resolves the files records name. */
export async function readWorkspace(store: Store, root: string, timings?: Partial<LoadTimings>): Promise<Workspace> {
  let mark = performance.now();
  const lap = (phase: 'files' | 'checks' | 'coverage') => {
    const now = performance.now();
    if (timings) timings[phase] = Math.round((now - mark) * 10) / 10;
    mark = now;
  };
  const order = await kindOrder(store);
  const read = readRecords(store, order);
  const targets = new Map<string, string[]>();
  for (const l of read.links) targets.set(l.source, [...(targets.get(l.source) ?? []), l.target]);
  const { facts, mentions } = await gatherFileFacts(path.resolve(root), store, targets);
  const connection = store.connection;
  await connection.run(FACT_TABLES_SQL);
  await append(connection, 'file_facts', facts.map((f) => [f.record, f.kind, f.file, f.file_exists, f.contains_id, f.key_file, f.key_file_inside, f.key_file_exists]));
  await append(connection, 'file_mentions', mentions.map((m) => [m.record, m.mentioned]));
  await connection.run(COVERAGE_VIEWS_SQL);
  lap('files');
  const scope = new Map(read.records.map((r) => [r.id, r.product]));
  const problems = await runChecks(store, orderChecks(store.rows('check')), scope);
  lap('checks');
  const coverage = await computeCoverage(store);
  lap('coverage');
  return { ...read, problems, coverage };
}

/** A workspace whose data did not load: no records, and the store's refusals as data-refused errors. */
function refusedWorkspace(error: StoreError): Workspace {
  return {
    kinds: [], sections: [], relations: [], records: [], links: [], coverage: [],
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
    store = await openStore(config.root, storeOptions(options));
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
 * The reference for the product under root: its kinds, tables, relations and folders, with its own kinds and
 * relations, and every check (Lathe's, the engine's own, then the product's). While no data file or migration changes
 * (by size and modification time, or a file coming or going), the last answer stands.
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
