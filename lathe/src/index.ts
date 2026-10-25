// The Lathe engine: loads spec records from Markdown files, checks them against the
// meta-model in an in-memory DuckDB database, and computes traceability coverage.
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { COVERAGE_COUNTS_SQL, COVERAGE_GAPS_SQL, COVERAGE_TESTS_SQL } from './coverage.ts';
import { loadConfig, PACKAGE_DIR } from './config.ts';
import { hasFieldsColumns, parseRecordFile, proseTokens, readFieldsTable, type ProseToken } from './parse.ts';
import { ENGINE_CHECKS as ENGINE_CHECK_DOCS, parseCheckHeader, type CheckHeader, type CheckReference, type FormatReference, type KindReference } from './reference.ts';
import type { Coverage, CoverageGap, EntityField, Kind, ObligationCoverage, Problem, RelationRule, SectionRule, SpecLink, SpecRecord, TestCounts, Workspace } from './types.ts';

export type * from './types.ts';
export type * from './reference.ts';
export { renderReference, parseCheckHeader, kindAnchor, relationAnchor, sectionAnchor, checkAnchor } from './reference.ts';
export { loadConfig, PACKAGE_DIR, CONFIG_FILE, DEFAULT_MAX_CHILDREN, type LatheConfig } from './config.ts';

export const CHECKS_DIR = path.join(PACKAGE_DIR, 'checks');

export interface LoadOptions {
  /** Folder of check SQL files. Defaults to the package's checks/. */
  checksDir?: string;
  /** One folder holding kinds.csv, relations.csv, sections.csv and ids.csv, replacing the configured meta-model (used by tests). */
  metaDir?: string;
  /** Filled with how long each phase of the load took, in milliseconds (the performance budgets, LA-CHK-DR310). */
  timings?: Partial<LoadTimings>;
}

/** How long each phase of loadWorkspace took, in milliseconds. */
export interface LoadTimings {
  /** Finding the record files, reading and parsing them (changed files only, when a parse cache holds the rest), placing and citing. */
  parse: number;
  /** The facts about the files records name (a test's run_by, a component's file). */
  files: number;
  /** Creating the DuckDB database and loading the meta-model and the records into it. */
  load: number;
  /** Running Lathe's checks and the product's. */
  checks: number;
  /** Coverage per domain, and reading the meta-model back. */
  coverage: number;
  /** The whole load. */
  total: number;
  /** How many record files were read and parsed anew (the rest came from the parse cache). */
  parsed: number;
}

/**
 * A record file's parse, kept with the exact text it was parsed from, so a reload parses only the
 * files whose text changed (LA-CHK-DR310). Every load still reads every file afresh (LA-CHK-DR04):
 * the cache only skips parsing a text it has parsed before, which gives the same parse, so it holds
 * no state the files do not.
 */
interface ParseCacheEntry { text: string; result: ReturnType<typeof parseRecordFile> }
const parseCache = new Map<string, ParseCacheEntry>();
/** The most files the parse cache keeps; past it, it starts again (a guard for a server reading many products). */
const PARSE_CACHE_LIMIT = 50_000;

/** Empties the parse cache, so the next load parses every file anew (used by the performance measurements). */
export function clearParseCache() { parseCache.clear(); }

// Reads one record file and parses it, or takes its parse from the cache when its text is the one
// parsed before. A cached parse is never changed: each load copies the record.
async function parseFile(file: string): Promise<{ result: ReturnType<typeof parseRecordFile>; fresh: boolean }> {
  const text = await readFile(file, 'utf8');
  const known = parseCache.get(file);
  if (known && known.text === text) return { result: known.result, fresh: false };
  const result = parseRecordFile(text);
  if (parseCache.size >= PARSE_CACHE_LIMIT) parseCache.clear();
  parseCache.set(file, { text, result });
  return { result, fresh: true };
}

const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;
const toPosix = (p: string) => p.split(path.sep).join('/');

interface LoadedRecord extends SpecRecord {
  links: { relation: string; target: string }[];
}

interface FileFact {
  path: string;
  record: string;
  kind: string;
  file: string;
  file_exists: boolean;
  contains_id: boolean | null;
  /** A test's `key_file`, the file that holds its key when it runs from a shared class in another file, or null. */
  key_file: string | null;
  /** Whether the key_file sits under the product root; null when the test has none. */
  key_file_inside: boolean | null;
  /** Whether the key_file exists as a file under the product root; null when the test has none. */
  key_file_exists: boolean | null;
}

/** For a test's run_by file: each of the test's own ID and its link targets that the file mentions. */
interface FileMention {
  path: string;
  record: string;
  mentioned: string;
}

// Finds every *.md under the specs folder except README.md, as paths relative to root, sorted.
async function findRecordFiles(root: string, specsDir: string): Promise<string[]> {
  if (!existsSync(specsDir)) return [];
  const entries = await readdir(specsDir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
    .map((e) => toPosix(path.relative(root, path.join(e.parentPath, e.name))))
    .sort();
}

// Resolves a path named in a record, refusing anything outside root.
function resolveInside(root: string, file: string): string | null {
  const resolved = path.resolve(root, file);
  const rel = path.relative(root, resolved);
  return rel.startsWith('..') || path.isAbsolute(rel) ? null : resolved;
}

// A test's run_by must be a file; a component's file may also be a folder of files.
async function exists(file: string | null, allowFolder: boolean): Promise<boolean> {
  if (!file) return false;
  try {
    const info = await stat(file);
    return info.isFile() || (allowFolder && info.isDirectory());
  } catch {
    return false;
  }
}

/** An ID-shaped token a record's body cites (FORMAT.md section 12); it may not exist. */
interface ProseCitation {
  path: string;
  record: string;
  cited: string;
}

// Reads the IDs each record's body cites (FORMAT.md section 12). A token is a citation when it is the ID of a
// record, or starts with a known prefix followed by "-": every product's and domain's ID, and the config's
// idPrefixes. A product's or domain's own ID is too common a word to count in plain prose, so it is a citation
// only when written as a code span holding just that ID. Each record's mentions are the cited IDs that exist, in
// order of first mention, without repeats or its own ID; every distinct cited token is also returned so a check
// can report unknown ones.
function readProseCitations(records: LoadedRecord[], idPrefixes: string[]): ProseCitation[] {
  const ids = new Set(records.map((r) => r.id).filter((id) => id !== ''));
  const bare = new Set(records.filter((r) => (r.kind === 'product' || r.kind === 'domain') && r.id !== '').map((r) => r.id));
  const prefixes = [...bare, ...idPrefixes];
  const isCitation = ({ token, inCode }: ProseToken) =>
    bare.has(token) ? inCode : ids.has(token) || prefixes.some((p) => token.startsWith(`${p}-`));
  const citations: ProseCitation[] = [];
  for (const r of records) {
    const cited = [...new Set(proseTokens(r.body).filter(isCitation).map((t) => t.token))].filter((token) => token !== r.id);
    r.mentions = cited.filter((id) => ids.has(id));
    citations.push(...cited.map((id) => ({ path: r.path, record: r.id, cited: id })));
  }
  return citations;
}

/** What an entity's or domain event's Fields table says (FORMAT.md sections 17 and 18), for the entity-fields check. */
interface EntityTableFact {
  path: string;
  record: string;
  heading: boolean;
  columns: string | null;
  columns_ok: boolean;
}

/** The kinds whose body holds a Fields table: an entity's fields, and what a domain event carries. */
const FIELDS_KINDS = new Set(['entity', 'domain_event']);

// Reads each entity's and domain event's Fields table into its entityFields, in table order, and returns the
// facts the checks judge it by. A table without the right columns gives no fields: its column problem is the one reported.
// A row with fewer cells than the columns is read with the missing cells empty.
function readEntityFields(records: LoadedRecord[]): EntityTableFact[] {
  const facts: EntityTableFact[] = [];
  for (const r of records) {
    if (!FIELDS_KINDS.has(r.kind)) continue;
    const table = readFieldsTable(r.body);
    const ok = hasFieldsColumns(table.columns);
    r.entityFields = ok
      ? table.rows.map((cells): EntityField => {
          const [field = '', meaning = '', kind = '', example = ''] = cells;
          return { field, meaning, kind, example };
        })
      : [];
    facts.push({ path: r.path, record: r.id, heading: table.heading, columns: table.columns?.join(', ') ?? null, columns_ok: ok });
  }
  return facts;
}

// Walks parent links to find each record's product and domain; reports records on a parent loop.
function placeRecords(records: LoadedRecord[], problems: Problem[]) {
  const byId = new Map<string, LoadedRecord>();
  for (const r of records) if (r.id && !byId.has(r.id)) byId.set(r.id, r);
  for (const record of records) {
    const seen: string[] = [];
    let current: LoadedRecord | undefined = record;
    while (current) {
      if (seen.includes(current.id)) {
        if (current === record) {
          problems.push({
            severity: 'error',
            check: 'parent-cycle',
            record: record.id,
            message: `${record.id}'s parent chain loops back to itself: ${[...seen, record.id].join(' -> ')}.`,
          });
        }
        break;
      }
      seen.push(current.id);
      if (current.kind === 'product' && record.product === null) record.product = current.id;
      if (current.kind === 'domain' && record.domain === null) record.domain = current.id;
      current = current.parent ? byId.get(current.parent) : undefined;
    }
  }
}

// True if the text names the ID as a whole ID: TL-LEND-DR05 is not found in TL-LEND-DR050 or TL-LEND-DR05-R01.
function mentionsId(content: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9-])${escaped}(?![A-Za-z0-9]|-[A-Za-z0-9])`).test(content);
}

// Facts about the files records name: a test's run_by and a component's file. For a test, contains_id says
// whether the file names the test's own ID or, when the test has a `key`, whether the file contains that key
// text instead. Also which IDs the file mentions (its own and its link targets), so a check can accept a test
// whose file names every ID it proves. A test that runs from a shared class in another file names that file in
// `key_file`: its key, own ID and proved IDs are then looked for in the key file instead of run_by, which must
// still exist. A key file outside the root, or missing, contains nothing.
async function gatherFileFacts(root: string, records: LoadedRecord[]): Promise<{ facts: FileFact[]; mentions: FileMention[] }> {
  // Each record's files are read side by side; the facts keep record order.
  const each = await Promise.all(records.map(async (r) => {
    const facts: FileFact[] = [];
    const mentions: FileMention[] = [];
    const field = r.kind === 'test' ? 'run_by' : r.kind === 'component' ? 'file' : null;
    const file = field ? r.fields[field]?.trim() : undefined;
    if (!file) return { facts, mentions };
    const resolved = resolveInside(root, file);
    const found = await exists(resolved, r.kind === 'component');
    let containsId: boolean | null = null;
    const keyFile = r.kind === 'test' ? r.fields.key_file?.trim() || null : null;
    const keyResolved = keyFile ? resolveInside(root, keyFile) : null;
    const keyFound = keyFile ? await exists(keyResolved, false) : null;
    if (r.kind === 'test') {
      const source = keyFile ? (keyFound ? keyResolved : null) : found ? resolved : null;
      const content = source ? await readFile(source, 'utf8') : '';
      const key = r.fields.key?.trim();
      containsId = key ? content.includes(key) : r.id !== '' && mentionsId(content, r.id);
      const candidates = new Set([r.id, ...r.links.map((l) => l.target)].filter((id) => id !== ''));
      for (const id of candidates) if (mentionsId(content, id)) mentions.push({ path: r.path, record: r.id, mentioned: id });
    }
    facts.push({
      path: r.path, record: r.id, kind: r.kind, file, file_exists: found, contains_id: containsId,
      key_file: keyFile, key_file_inside: keyFile ? keyResolved !== null : null, key_file_exists: keyFound,
    });
    return { facts, mentions };
  }));
  return { facts: each.flatMap((e) => e.facts), mentions: each.flatMap((e) => e.mentions) };
}

async function append(
  connection: DuckDBConnection,
  table: string,
  rows: (string | number | boolean | null)[][],
) {
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

interface MetaKind {
  kind: string;
  label: string;
  stage: string;
  section: string;
  parent_kinds: string[];
  required_fields: string[];
  obligation: string;
  description: string;
}

interface MetaSection {
  section: string;
  stage: string;
  order: string;
  label: string;
  description: string;
}

const csvText = (value: unknown) => (typeof value === 'string' ? value : '');
const csvWords = (value: unknown) => csvText(value).trim().split(/\s+/).filter(Boolean);
const union = (a: string[], b: string[]) => [...a, ...b.filter((x) => !a.includes(x))];

// Loads the meta-model from one or more folders: Lathe's defaults first, then a product's extensions.
// A later row for a kind already defined widens it: parent_kinds and required_fields are unioned, and a
// non-empty label, stage, section, obligation or description replaces the earlier one. Sections (sections.csv,
// the folders kinds sit in) merge the same way: a later row for a section already listed replaces its stage,
// order, label or description with any that is non-empty. Relations work the same
// way: a later row with the same relation, source kind and target kind is the same rule, and its non-empty
// role, description, forward_label or reverse_label replaces the earlier one. Every kind and relation row is also kept, with the file it
// came from, in meta_kind_rows and meta_relation_rows, so that a duplicate within one folder can be reported.
// A kind's obligation value is read in any letter case: `yes` or `true` makes it an obligation, `proof` an
// obligation that needs proof only (proof_only), and anything else not an obligation.
async function loadMeta(connection: DuckDBConnection, metaDirs: string[], root: string) {
  const defaultMeta = path.join(PACKAGE_DIR, 'meta');
  const where = (dir: string, name: string) =>
    path.resolve(dir) === defaultMeta ? `Lathe's meta/${name}` : `${toPosix(path.relative(root, path.resolve(dir))) || '.'}/${name}`;
  const read = async (dir: string, name: string) => {
    const file = path.join(dir, name);
    if (!existsSync(file)) return [];
    return readRows<Record<string, string | null>>(
      connection,
      `SELECT * FROM read_csv(${sqlString(file)}, header = true, all_varchar = true, null_padding = true)`,
    );
  };

  const kindRows: string[][] = [];
  const kinds: MetaKind[] = [];
  const byKind = new Map<string, MetaKind>();
  const relationRows: string[][] = [];
  const relations: string[][] = [];
  const byRule = new Map<string, string[]>();
  const sections: MetaSection[] = [];
  const bySection = new Map<string, MetaSection>();
  const ids = new Map<string, { pattern: string; example: string }>();
  for (const dir of metaDirs) {
    // ids.csv gives each kind's ID convention; a later row for a kind replaces its pattern or example with any that is non-empty.
    for (const row of await read(dir, 'ids.csv')) {
      const kind = csvText(row.kind).trim();
      if (kind === '') continue;
      const known = ids.get(kind) ?? { pattern: '', example: '' };
      ids.set(kind, { pattern: csvText(row.pattern).trim() || known.pattern, example: csvText(row.example).trim() || known.example });
    }
    for (const row of await read(dir, 'kinds.csv')) {
      const name = csvText(row.kind).trim();
      kindRows.push([where(dir, 'kinds.csv'), name]);
      const incoming: MetaKind = {
        kind: name,
        label: csvText(row.label),
        stage: csvText(row.stage).trim(),
        section: csvText(row.section).trim(),
        parent_kinds: csvWords(row.parent_kinds),
        required_fields: csvWords(row.required_fields),
        obligation: csvText(row.obligation).trim(),
        description: csvText(row.description),
      };
      const known = name === '' ? undefined : byKind.get(name);
      if (!known) {
        kinds.push(incoming);
        if (name !== '') byKind.set(name, incoming);
        continue;
      }
      known.parent_kinds = union(known.parent_kinds, incoming.parent_kinds);
      known.required_fields = union(known.required_fields, incoming.required_fields);
      for (const key of ['label', 'stage', 'section', 'obligation', 'description'] as const) {
        if (incoming[key].trim() !== '') known[key] = incoming[key];
      }
    }
    for (const row of await read(dir, 'sections.csv')) {
      const incoming: MetaSection = {
        section: csvText(row.section).trim(),
        stage: csvText(row.stage).trim(),
        order: csvText(row.order).trim(),
        label: csvText(row.label),
        description: csvText(row.description),
      };
      if (incoming.section === '') continue;
      const known = bySection.get(incoming.section);
      if (!known) {
        sections.push(incoming);
        bySection.set(incoming.section, incoming);
        continue;
      }
      for (const key of ['stage', 'order', 'label', 'description'] as const) {
        if (incoming[key].trim() !== '') known[key] = incoming[key];
      }
    }
    for (const row of await read(dir, 'relations.csv')) {
      const [relation, source, target, role] = [row.relation, row.source_kind, row.target_kind, row.role].map((v) => csvText(v).trim());
      const description = csvText(row.description);
      const [forward, reverse] = [row.forward_label, row.reverse_label].map((v) => csvText(v).trim());
      relationRows.push([where(dir, 'relations.csv'), relation, source, target]);
      const key = JSON.stringify([relation, source, target]);
      const known = byRule.get(key);
      if (!known) {
        const incoming = [relation, source, target, role, description, forward, reverse];
        relations.push(incoming);
        byRule.set(key, incoming);
        continue;
      }
      if (role !== '') known[3] = role;
      if (description.trim() !== '') known[4] = description;
      if (forward !== '') known[5] = forward;
      if (reverse !== '') known[6] = reverse;
    }
  }

  await connection.run(`
    CREATE TABLE meta_kind_rows (folder VARCHAR, kind VARCHAR);
    CREATE TABLE meta_relation_rows (folder VARCHAR, relation VARCHAR, source_kind VARCHAR, target_kind VARCHAR);
    CREATE TABLE meta_kinds_in (kind VARCHAR, label VARCHAR, stage VARCHAR, section VARCHAR, parent_kinds VARCHAR,
                                required_fields VARCHAR, obligation VARCHAR, description VARCHAR);
    CREATE TABLE relations (relation VARCHAR, source_kind VARCHAR, target_kind VARCHAR, role VARCHAR, description VARCHAR,
                            forward_label VARCHAR, reverse_label VARCHAR);
    CREATE TABLE meta_sections_in (section VARCHAR, stage VARCHAR, "order" VARCHAR, label VARCHAR, description VARCHAR);
    CREATE TABLE kind_ids (kind VARCHAR, pattern VARCHAR, example VARCHAR);
  `);
  await append(connection, 'kind_ids', [...ids].map(([kind, id]) => [kind, id.pattern, id.example]));
  await append(connection, 'meta_kind_rows', kindRows);
  await append(
    connection,
    'meta_kinds_in',
    kinds.map((k) => [k.kind, k.label, k.stage, k.section, k.parent_kinds.join(' '), k.required_fields.join(' '), k.obligation, k.description]),
  );
  await append(connection, 'meta_relation_rows', relationRows);
  await append(connection, 'relations', relations);
  await append(connection, 'meta_sections_in', sections.map((s) => [s.section, s.stage, s.order, s.label, s.description]));
  const list = (col: string) => `CASE WHEN ${col} = '' THEN []::VARCHAR[] ELSE string_split(${col}, ' ') END AS ${col}`;
  await connection.run(`
    CREATE TABLE kinds AS
    SELECT kind, label, stage, section, ${list('parent_kinds')}, ${list('required_fields')},
           lower(trim(obligation)) IN ('yes', 'true', 'proof') AS obligation,
           lower(trim(obligation)) = 'proof' AS proof_only, description
    FROM meta_kinds_in;
    DROP TABLE meta_kinds_in;
    -- The folders, in stage then order: product-level folders (no stage) first, then define, then design.
    CREATE TABLE sections AS
    SELECT section, stage, coalesce(TRY_CAST(trim("order") AS INTEGER), 0) AS "order", label, description
    FROM meta_sections_in
    ORDER BY stage, "order", section;
    DROP TABLE meta_sections_in;
  `);
}

async function readRows<T>(connection: DuckDBConnection, sql: string): Promise<T[]> {
  return (await connection.runAndReadAll(sql)).getRowObjectsJson() as unknown as T[];
}

/** A check file's name without its number and .sql: 16-unproved.sql is the check unproved. */
const checkName = (file: string) => file.replace(/\.sql$/, '').replace(/^\d+[-_]/, '');
const sqlFiles = async (dir: string) => (existsSync(dir) ? (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort() : []);

/** Names of the problems the engine reports itself, outside any check file; a product check may not take them. */
const ENGINE_CHECKS = ENGINE_CHECK_DOCS.map((c) => c.check);

/** A check file, with where it is from and what its header says. */
interface CheckFile {
  file: string;
  dir: string;
  check: string;
  origin: 'lathe' | 'product';
  /** Lathe's checks as checks/<file>; the product's as a path from the root. */
  source: string;
  header: CheckHeader;
}

/** The check files that run, Lathe's then the product's, and the problems found reading the folders. */
interface CheckFiles {
  files: CheckFile[];
  /** A product check name clash, or a missing product checks folder. */
  problems: Problem[];
}

// Finds Lathe's check files, then the product's own checks folder if it has one (FORMAT.md section 13), and
// reads each file's header. A product check named like one of Lathe's checks is not run: it is a
// product-check-name-clash error, so the two never mix in a report.
async function findCheckFiles(checksDir: string, productChecksDir: string | null, root: string): Promise<CheckFiles> {
  const read = async (dir: string, file: string, origin: 'lathe' | 'product', source: string): Promise<CheckFile> => ({
    file,
    dir,
    check: checkName(file),
    origin,
    source,
    header: parseCheckHeader(await readFile(path.join(dir, file), 'utf8')),
  });
  const latheFiles = await sqlFiles(checksDir);
  const files: CheckFile[] = [];
  for (const file of latheFiles) files.push(await read(checksDir, file, 'lathe', `checks/${file}`));
  const problems: Problem[] = [];
  if (productChecksDir === null) return { files, problems };
  const where = (file: string) => toPosix(path.relative(root, path.join(productChecksDir, file)));
  if (!existsSync(productChecksDir)) {
    const folder = toPosix(path.relative(root, productChecksDir)) || '.';
    problems.push({
      severity: 'error',
      check: 'product-checks-missing',
      record: null,
      message: `lathe.config.json names the checks folder ${folder}, but there is no such folder.`,
    });
    return { files, problems };
  }
  const taken = new Set([...latheFiles.map(checkName), ...ENGINE_CHECKS]);
  for (const file of await sqlFiles(productChecksDir)) {
    if (!taken.has(checkName(file))) {
      files.push(await read(productChecksDir, file, 'product', where(file)));
      continue;
    }
    problems.push({
      severity: 'error',
      check: 'product-check-name-clash',
      record: null,
      message: `The product check ${where(file)} is named ${checkName(file)}, as one of Lathe's checks is, so it was not run; rename the file.`,
    });
  }
  return { files, problems };
}

// Runs Lathe's checks, then the product's, against the same tables and with the same row contract. The
// folder problems (a name clash, a missing product folder) come between the two.
async function runChecks(instance: DuckDBInstance, connection: DuckDBConnection, found: CheckFiles): Promise<Problem[]> {
  const lathe = found.files.filter((f) => f.origin === 'lathe');
  const product = found.files.filter((f) => f.origin === 'product');
  return [...(await runCheckFiles(instance, connection, lathe)), ...found.problems, ...(await runCheckFiles(instance, connection, product))];
}

// Loads what each check file's header says into check_docs, for the undocumented check: one row per file
// that runs, with what its header lacks in `missing` (empty when it is complete).
async function loadCheckDocs(connection: DuckDBConnection, files: CheckFile[]) {
  await connection.run(
    'CREATE TABLE check_docs (source VARCHAR, "check" VARCHAR, origin VARCHAR, summary VARCHAR, explanation VARCHAR, severity VARCHAR, missing VARCHAR)',
  );
  await append(
    connection,
    'check_docs',
    files.map((f) => [f.source, f.check, f.origin, f.header.summary, f.header.explanation, f.header.severities.join(', '), f.header.missing.join(', ')]),
  );
}

/** How many checks run at once, each on its own connection to the same database. */
const CHECK_CONNECTIONS = 4;

// Runs the given check files and returns their problems in file order. A check that fails to run becomes an
// error problem naming its file. Checks only read the tables, so they run side by side on a few connections
// to the same database; their problems are put back in file order, so the report is the same as one by one.
async function runCheckFiles(instance: DuckDBInstance, connection: DuckDBConnection, files: CheckFile[]): Promise<Problem[]> {
  const runOne = async (on: DuckDBConnection, { file, dir, check, source }: CheckFile): Promise<Problem[]> => {
    const sql = await readFile(path.join(dir, file), 'utf8');
    try {
      // The check's own "check" column is ignored: the file name is the check's name.
      const rows = await readRows<{ severity: string; record: string | null; message: string }>(on, sql);
      return rows.map((row) => ({
        severity: row.severity === 'warning' ? 'warning' : 'error',
        check,
        record: row.record === null || row.record === '' ? null : String(row.record),
        message: String(row.message),
      }));
    } catch (error) {
      return [{
        severity: 'error',
        check,
        record: null,
        message: `The check ${source} could not run:${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
      }];
    }
  };
  if (files.length === 0) return [];
  const results: Problem[][] = new Array(files.length);
  const extra = await Promise.all(Array.from({ length: Math.min(CHECK_CONNECTIONS, files.length) - 1 }, () => instance.connect()));
  const connections = [connection, ...extra];
  let next = 0;
  try {
    await Promise.all(connections.map(async (on) => {
      while (next < files.length) {
        const at = next++;
        results[at] = await runOne(on, files[at]);
      }
    }));
  } finally {
    for (const c of extra) c.closeSync();
  }
  return results.flat();
}

// Coverage per domain: one entry per obligation kind in meta-model order, and the domain's tests by state.
// The four queries only read, so they run side by side, each on its own connection.
async function computeCoverage(instance: DuckDBInstance): Promise<Coverage[]> {
  const on = async <T,>(sql: string) => {
    const c = await instance.connect();
    try { return await readRows<T>(c, sql); } finally { c.closeSync(); }
  };
  const [rows, gaps, tests, domains] = await Promise.all([
    on<ObligationCoverage & { domain: string }>(COVERAGE_COUNTS_SQL),
    on<CoverageGap & { domain: string }>(COVERAGE_GAPS_SQL),
    on<TestCounts & { domain: string }>(COVERAGE_TESTS_SQL),
    on<{ id: string }>("SELECT DISTINCT id FROM records WHERE kind = 'domain' AND id <> '' ORDER BY id"),
  ]);
  return domains.map(({ id: domain }) => {
    const obligations = rows.filter((r) => r.domain === domain).map(({ domain: _domain, ...o }) => o);
    return {
      domain,
      obligations,
      tests: (({ automated, manual, planned }) => ({ automated, manual, planned }))(tests.find((t) => t.domain === domain) ?? { automated: 0, manual: 0, planned: 0 }),
      gaps: gaps.filter((g) => g.domain === domain).map(({ id, kind, missing }) => ({ id, kind, missing })),
    };
  });
}

/** Loads, checks and measures the spec workspace under root (the repo root). */
export async function loadWorkspace(root: string, options: LoadOptions = {}): Promise<Workspace> {
  const config = loadConfig(root);
  root = config.root;
  const metaDirs = options.metaDir ? [options.metaDir] : config.metaDirs;
  const checksDir = options.checksDir ?? CHECKS_DIR;
  const problems: Problem[] = [];

  const timings = options.timings;
  const started = performance.now();
  let mark = started;
  const lap = (phase: Exclude<keyof LoadTimings, 'total' | 'parsed'>) => {
    const now = performance.now();
    if (timings) timings[phase] = Math.round((now - mark) * 10) / 10;
    mark = now;
  };

  const records: LoadedRecord[] = [];
  const files = await findRecordFiles(root, config.specsDir);
  const parsed = await Promise.all(files.map((file) => parseFile(path.join(root, file))));
  files.forEach((file, i) => {
    const { result } = parsed[i];
    if (!result.ok) {
      problems.push({ severity: 'error', check: 'parse-error', record: null, message: `${file} cannot be read: ${result.reason}.` });
      return;
    }
    records.push({ ...result.record, product: null, domain: null, path: file, mentions: [] });
  });
  if (timings) timings.parsed = parsed.filter((p) => p.fresh).length;
  placeRecords(records, problems);
  const citations = readProseCitations(records, config.idPrefixes);
  const entityTables = readEntityFields(records);
  lap('parse');
  const { facts, mentions } = await gatherFileFacts(root, records);
  lap('files');

  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  try {
    await loadMeta(connection, metaDirs, root);
    await connection.run(`
      CREATE TABLE records (path VARCHAR, id VARCHAR, kind VARCHAR, title VARCHAR, parent VARCHAR,
                            product VARCHAR, domain VARCHAR, body VARCHAR);
      CREATE TABLE fields (path VARCHAR, record VARCHAR, name VARCHAR, value VARCHAR);
      CREATE TABLE links (path VARCHAR, source VARCHAR, relation VARCHAR, target VARCHAR);
      CREATE TABLE file_facts (path VARCHAR, record VARCHAR, kind VARCHAR, file VARCHAR,
                               file_exists BOOLEAN, contains_id BOOLEAN,
                               key_file VARCHAR, key_file_inside BOOLEAN, key_file_exists BOOLEAN);
      CREATE TABLE file_mentions (path VARCHAR, record VARCHAR, mentioned VARCHAR);
    `);
    await append(connection, 'records', records.map((r) => [r.path, r.id, r.kind, r.title, r.parent, r.product, r.domain, r.body]));
    await append(connection, 'fields', records.flatMap((r) => Object.entries(r.fields).map(([name, value]) => [r.path, r.id, name, value])));
    await append(connection, 'links', records.flatMap((r) => r.links.map((l) => [r.path, r.id, l.relation, l.target])));
    await append(connection, 'file_facts', facts.map((f) => [f.path, f.record, f.kind, f.file, f.file_exists, f.contains_id, f.key_file, f.key_file_inside, f.key_file_exists]));
    await append(connection, 'file_mentions', mentions.map((m) => [m.path, m.record, m.mentioned]));
    // Every distinct ID a record's body cites (a record's ID, or a token with a known prefix), existing or not.
    await connection.run('CREATE TABLE prose_mentions (path VARCHAR, record VARCHAR, cited VARCHAR)');
    await append(connection, 'prose_mentions', citations.map((c) => [c.path, c.record, c.cited]));
    // Each entity's and domain event's Fields table (FORMAT.md sections 17 and 18): whether it has the heading,
    // the table's columns, and, when they are right, its rows in table order (position from 1).
    await connection.run(`
      CREATE TABLE entity_tables (path VARCHAR, record VARCHAR, heading BOOLEAN, columns VARCHAR, columns_ok BOOLEAN);
      CREATE TABLE entity_fields (path VARCHAR, record VARCHAR, position INTEGER, field VARCHAR, meaning VARCHAR,
                                  kind VARCHAR, example VARCHAR);
    `);
    await append(connection, 'entity_tables', entityTables.map((t) => [t.path, t.record, t.heading, t.columns, t.columns_ok]));
    await append(
      connection,
      'entity_fields',
      records.flatMap((r) => (r.entityFields ?? []).map((f, i) => [r.path, r.id, i + 1, f.field, f.meaning, f.kind, f.example])),
    );
    // The product's settings from lathe.config.json that checks read, one row each, such as structure.maxChildren.
    await connection.run('CREATE TABLE settings (name VARCHAR, value VARCHAR)');
    await append(connection, 'settings', [['structure.maxChildren', String(config.maxChildren)]]);

    const checkFiles = await findCheckFiles(checksDir, config.checksDir, root);
    await loadCheckDocs(connection, checkFiles.files);
    lap('load');
    problems.push(...(await runChecks(instance, connection, checkFiles)));
    lap('checks');
    const coverage = await computeCoverage(instance);
    const kinds = await readRows<Kind>(connection, 'SELECT * FROM kinds');
    const relations = await readRows<RelationRule>(connection, 'SELECT * FROM relations');
    const sections = await readRows<SectionRule>(connection, 'SELECT * FROM sections ORDER BY stage, "order", section');
    lap('coverage');
    if (timings) timings.total = Math.round((performance.now() - started) * 10) / 10;

    const links: SpecLink[] = records.flatMap((r) => r.links.map((l) => ({ source: r.id, relation: l.relation, target: l.target })));
    const specRecords: SpecRecord[] = records.map(({ links: _links, ...r }) => r);
    return { kinds, sections, relations, records: specRecords, links, problems, coverage };
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

/** Lathe's record format concepts, the Markdown that starts the reference. */
export const FORMAT_FILE = path.join(PACKAGE_DIR, 'FORMAT.md');

/**
 * The format reference for the product under root: its kinds, relations and folders after its extensions, and
 * every check (Lathe's, the engine's own, then the product's) as its header documents it. Reads no records.
 */
export async function formatReference(root: string, options: LoadOptions = {}): Promise<FormatReference> {
  const config = loadConfig(root);
  const metaDirs = options.metaDir ? [options.metaDir] : config.metaDirs;
  const checksDir = options.checksDir ?? CHECKS_DIR;
  // The reference reads only the meta-model, the check files, FORMAT.md and the config: while none of them
  // changes (by size and modification time, or a file coming or going), the last answer stands.
  const key = await referenceKey(config.root, [...metaDirs, checksDir, ...(config.checksDir ? [config.checksDir] : [])]);
  const known = referenceCache.get(key);
  if (known) return known;
  const reference = await buildReference(config.root, metaDirs, checksDir, config.checksDir);
  if (referenceCache.size > 16) referenceCache.clear();
  referenceCache.set(key, reference);
  return reference;
}

const referenceCache = new Map<string, FormatReference>();

/** What the reference depends on, as one string: each file in those folders, FORMAT.md and the config, with its size and modification time. */
async function referenceKey(root: string, dirs: string[]): Promise<string> {
  const files = [FORMAT_FILE, path.join(root, 'lathe.config.json')];
  for (const dir of dirs) {
    if (!existsSync(dir)) { files.push(`${dir} (missing)`); continue; }
    for (const name of (await readdir(dir)).sort()) files.push(path.join(dir, name));
  }
  const parts = await Promise.all(files.map(async (file) => {
    try {
      const info = await stat(file);
      return `${file}:${info.size}:${info.mtimeMs}`;
    } catch {
      return `${file}:none`;
    }
  }));
  return [root, ...parts].join('\n');
}

async function buildReference(root: string, metaDirs: string[], checksDir: string, productChecksDir: string | null): Promise<FormatReference> {
  const found = await findCheckFiles(checksDir, productChecksDir, root);
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  try {
    await loadMeta(connection, metaDirs, root);
    const kinds = await readRows<Kind>(connection, 'SELECT * FROM kinds');
    const ids = await readRows<{ kind: string; pattern: string; example: string }>(connection, 'SELECT * FROM kind_ids');
    const relations = await readRows<RelationRule>(connection, 'SELECT * FROM relations');
    const sections = await readRows<SectionRule>(connection, 'SELECT * FROM sections ORDER BY stage, "order", section');
    const kindRefs: KindReference[] = kinds.map((k) => {
      const id = ids.find((i) => i.kind === k.kind);
      return {
        kind: k.kind,
        label: k.label,
        description: k.description,
        stage: k.stage,
        section: k.section,
        parent_kinds: k.parent_kinds,
        child_kinds: kinds.filter((c) => c.parent_kinds.includes(k.kind)).map((c) => c.kind),
        required_fields: k.required_fields,
        obligation: k.proof_only ? 'proof' : k.obligation ? 'yes' : 'no',
        id: id && id.pattern ? { pattern: id.pattern, example: id.example } : null,
      };
    });
    const fromFile = (f: CheckFile): CheckReference => ({
      check: f.check,
      severity: f.header.severities[0] ?? 'error',
      severities: f.header.severities,
      summary: f.header.summary,
      explanation: f.header.explanation,
      origin: f.origin,
      source: f.source,
      kinds: f.header.kinds,
    });
    return {
      concepts: await readFile(FORMAT_FILE, 'utf8'),
      kinds: kindRefs,
      relations: relations.map(({ relation, source_kind, target_kind, role, description, forward_label, reverse_label }) => ({
        relation, source_kind, target_kind, role, description, forward_label, reverse_label,
      })),
      sections,
      checks: [
        ...found.files.filter((f) => f.origin === 'lathe').map(fromFile),
        ...ENGINE_CHECK_DOCS,
        ...found.files.filter((f) => f.origin === 'product').map(fromFile),
      ],
    };
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}
