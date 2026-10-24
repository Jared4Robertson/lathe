// The Lathe engine: loads spec records from Markdown files, checks them against the
// meta-model in an in-memory DuckDB database, and computes traceability coverage.
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { COVERAGE_COUNTS_SQL, COVERAGE_GAPS_SQL } from './coverage.ts';
import { loadConfig, PACKAGE_DIR } from './config.ts';
import { idTokensInProse, parseRecordFile } from './parse.ts';
import type { Coverage, CoverageGap, Kind, ObligationCoverage, Problem, RelationRule, SpecLink, SpecRecord, Workspace } from './types.ts';

export type * from './types.ts';
export { loadConfig, PACKAGE_DIR, CONFIG_FILE, type LatheConfig } from './config.ts';

export const CHECKS_DIR = path.join(PACKAGE_DIR, 'checks');

export interface LoadOptions {
  /** Folder of check SQL files. Defaults to the package's checks/. */
  checksDir?: string;
  /** One folder holding kinds.csv and relations.csv, replacing the configured meta-model (used by tests). */
  metaDir?: string;
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

/** An ID-shaped token a record's body cites with a product prefix of this workspace; it may not exist. */
interface ProseCitation {
  path: string;
  record: string;
  cited: string;
}

// Reads the IDs each record's body cites (FORMAT.md section 12). A token counts only if it equals a product's ID
// or starts with one followed by "-". Each record's mentions are the cited IDs that exist, in order of first
// mention, without repeats or its own ID; every distinct cited token is also returned so a check can report unknown ones.
function readProseCitations(records: LoadedRecord[]): ProseCitation[] {
  const ids = new Set(records.map((r) => r.id).filter((id) => id !== ''));
  const products = records.filter((r) => r.kind === 'product' && r.id !== '').map((r) => r.id);
  const known = (token: string) => products.some((p) => token === p || token.startsWith(`${p}-`));
  const citations: ProseCitation[] = [];
  for (const r of records) {
    const cited = [...new Set(idTokensInProse(r.body))].filter((token) => token !== r.id && known(token));
    r.mentions = cited.filter((id) => ids.has(id));
    citations.push(...cited.map((id) => ({ path: r.path, record: r.id, cited: id })));
  }
  return citations;
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
// whose file names every ID it proves.
async function gatherFileFacts(root: string, records: LoadedRecord[]): Promise<{ facts: FileFact[]; mentions: FileMention[] }> {
  const facts: FileFact[] = [];
  const mentions: FileMention[] = [];
  for (const r of records) {
    const field = r.kind === 'test' ? 'run_by' : r.kind === 'component' ? 'file' : null;
    const file = field ? r.fields[field]?.trim() : undefined;
    if (!file) continue;
    const resolved = resolveInside(root, file);
    const found = await exists(resolved, r.kind === 'component');
    let containsId: boolean | null = null;
    if (r.kind === 'test') {
      const content = found ? await readFile(resolved!, 'utf8') : '';
      const key = r.fields.key?.trim();
      containsId = key ? content.includes(key) : r.id !== '' && mentionsId(content, r.id);
      const candidates = new Set([r.id, ...r.links.map((l) => l.target)].filter((id) => id !== ''));
      for (const id of candidates) if (mentionsId(content, id)) mentions.push({ path: r.path, record: r.id, mentioned: id });
    }
    facts.push({ path: r.path, record: r.id, kind: r.kind, file, file_exists: found, contains_id: containsId });
  }
  return { facts, mentions };
}

async function append(
  connection: DuckDBConnection,
  table: string,
  rows: (string | boolean | null)[][],
) {
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

interface MetaKind {
  kind: string;
  label: string;
  stage: string;
  parent_kinds: string[];
  required_fields: string[];
  obligation: string;
  description: string;
}

const csvText = (value: unknown) => (typeof value === 'string' ? value : '');
const csvWords = (value: unknown) => csvText(value).trim().split(/\s+/).filter(Boolean);
const union = (a: string[], b: string[]) => [...a, ...b.filter((x) => !a.includes(x))];

// Loads the meta-model from one or more folders: Lathe's defaults first, then a product's extensions.
// A later row for a kind already defined widens it: parent_kinds and required_fields are unioned, and a
// non-empty label, stage, obligation or description replaces the earlier one. A relation row identical to
// one in an earlier folder is dropped. Every kind row is also kept, with the file it came from, in
// meta_kind_rows, so that a kind defined twice within one folder can be reported.
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
  const relations: { folder: number; row: string[] }[] = [];
  for (const [index, dir] of metaDirs.entries()) {
    for (const row of await read(dir, 'kinds.csv')) {
      const name = csvText(row.kind).trim();
      kindRows.push([where(dir, 'kinds.csv'), name]);
      const incoming: MetaKind = {
        kind: name,
        label: csvText(row.label),
        stage: csvText(row.stage).trim(),
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
      for (const key of ['label', 'stage', 'obligation', 'description'] as const) {
        if (incoming[key].trim() !== '') known[key] = incoming[key];
      }
    }
    for (const row of await read(dir, 'relations.csv')) {
      const values = [row.relation, row.source_kind, row.target_kind, row.role].map((v) => csvText(v).trim());
      const full = [...values, csvText(row.description)];
      if (relations.some((r) => r.folder < index && r.row.every((v, i) => v === full[i]))) continue;
      relations.push({ folder: index, row: full });
    }
  }

  await connection.run(`
    CREATE TABLE meta_kind_rows (folder VARCHAR, kind VARCHAR);
    CREATE TABLE meta_kinds_in (kind VARCHAR, label VARCHAR, stage VARCHAR, parent_kinds VARCHAR,
                                required_fields VARCHAR, obligation VARCHAR, description VARCHAR);
    CREATE TABLE relations (relation VARCHAR, source_kind VARCHAR, target_kind VARCHAR, role VARCHAR, description VARCHAR);
  `);
  await append(connection, 'meta_kind_rows', kindRows);
  await append(
    connection,
    'meta_kinds_in',
    kinds.map((k) => [k.kind, k.label, k.stage, k.parent_kinds.join(' '), k.required_fields.join(' '), k.obligation, k.description]),
  );
  await append(connection, 'relations', relations.map((r) => r.row));
  const list = (col: string) => `CASE WHEN ${col} = '' THEN []::VARCHAR[] ELSE string_split(${col}, ' ') END AS ${col}`;
  await connection.run(`
    CREATE TABLE kinds AS
    SELECT kind, label, stage, ${list('parent_kinds')}, ${list('required_fields')},
           lower(obligation) IN ('yes', 'true') AS obligation, description
    FROM meta_kinds_in;
    DROP TABLE meta_kinds_in;
  `);
}

async function readRows<T>(connection: DuckDBConnection, sql: string): Promise<T[]> {
  return (await connection.runAndReadAll(sql)).getRowObjectsJson() as unknown as T[];
}

// Runs every check file in name order. A check that fails to run becomes an error problem.
async function runChecks(connection: DuckDBConnection, checksDir: string): Promise<Problem[]> {
  const files = existsSync(checksDir) ? (await readdir(checksDir)).filter((f) => f.endsWith('.sql')).sort() : [];
  const problems: Problem[] = [];
  for (const file of files) {
    const check = file.replace(/\.sql$/, '').replace(/^\d+[-_]/, '');
    const sql = await readFile(path.join(checksDir, file), 'utf8');
    try {
      // The check's own "check" column is ignored: the file name is the check's name.
      const rows = await readRows<{ severity: string; record: string | null; message: string }>(connection, sql);
      for (const row of rows) {
        problems.push({
          severity: row.severity === 'warning' ? 'warning' : 'error',
          check,
          record: row.record === null || row.record === '' ? null : String(row.record),
          message: String(row.message),
        });
      }
    } catch (error) {
      problems.push({
        severity: 'error',
        check,
        record: null,
        message: `The check ${file} could not run: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
      });
    }
  }
  return problems;
}

// Coverage per domain: one entry per obligation kind in meta-model order, with the older
// requirements_* and rules_* fields filled from the requirement and domain_rule entries.
async function computeCoverage(connection: DuckDBConnection): Promise<Coverage[]> {
  const rows = await readRows<ObligationCoverage & { domain: string }>(connection, COVERAGE_COUNTS_SQL);
  const gaps = await readRows<CoverageGap & { domain: string }>(connection, COVERAGE_GAPS_SQL);
  const domains = await readRows<{ id: string }>(connection, "SELECT DISTINCT id FROM records WHERE kind = 'domain' AND id <> '' ORDER BY id");
  return domains.map(({ id: domain }) => {
    const obligations = rows.filter((r) => r.domain === domain).map(({ domain: _domain, ...o }) => o);
    const of = (kind: string) => obligations.find((o) => o.kind === kind);
    const req = of('requirement');
    const rule = of('domain_rule');
    return {
      domain,
      requirements: req?.total ?? 0,
      requirements_satisfied: req?.designed ?? 0,
      requirements_built: req?.built ?? 0,
      requirements_proved: req?.proved ?? 0,
      rules: rule?.total ?? 0,
      rules_satisfied: rule?.designed ?? 0,
      rules_built: rule?.built ?? 0,
      rules_proved: rule?.proved ?? 0,
      obligations,
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

  const records: LoadedRecord[] = [];
  for (const file of await findRecordFiles(root, config.specsDir)) {
    const result = parseRecordFile(await readFile(path.join(root, file), 'utf8'));
    if (!result.ok) {
      problems.push({ severity: 'error', check: 'parse-error', record: null, message: `${file} cannot be read: ${result.reason}.` });
      continue;
    }
    records.push({ ...result.record, product: null, domain: null, path: file, mentions: [] });
  }
  placeRecords(records, problems);
  const citations = readProseCitations(records);
  const { facts, mentions } = await gatherFileFacts(root, records);

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
                               file_exists BOOLEAN, contains_id BOOLEAN);
      CREATE TABLE file_mentions (path VARCHAR, record VARCHAR, mentioned VARCHAR);
    `);
    await append(connection, 'records', records.map((r) => [r.path, r.id, r.kind, r.title, r.parent, r.product, r.domain, r.body]));
    await append(connection, 'fields', records.flatMap((r) => Object.entries(r.fields).map(([name, value]) => [r.path, r.id, name, value])));
    await append(connection, 'links', records.flatMap((r) => r.links.map((l) => [r.path, r.id, l.relation, l.target])));
    await append(connection, 'file_facts', facts.map((f) => [f.path, f.record, f.kind, f.file, f.file_exists, f.contains_id]));
    await append(connection, 'file_mentions', mentions.map((m) => [m.path, m.record, m.mentioned]));
    // Every distinct ID-shaped token with a workspace product prefix that a record's body cites, existing or not.
    await connection.run('CREATE TABLE prose_mentions (path VARCHAR, record VARCHAR, cited VARCHAR)');
    await append(connection, 'prose_mentions', citations.map((c) => [c.path, c.record, c.cited]));

    problems.push(...(await runChecks(connection, checksDir)));
    const coverage = await computeCoverage(connection);
    const kinds = await readRows<Kind>(connection, 'SELECT * FROM kinds');
    const relations = await readRows<RelationRule>(connection, 'SELECT * FROM relations');

    const links: SpecLink[] = records.flatMap((r) => r.links.map((l) => ({ source: r.id, relation: l.relation, target: l.target })));
    const specRecords: SpecRecord[] = records.map(({ links: _links, ...r }) => r);
    return { kinds, relations, records: specRecords, links, problems, coverage };
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}
