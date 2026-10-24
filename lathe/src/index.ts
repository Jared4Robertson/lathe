// The Lathe engine: loads spec records from Markdown files, checks them against the
// meta-model in an in-memory DuckDB database, and computes traceability coverage.
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { COVERAGE_COUNTS_SQL, COVERAGE_GAPS_SQL } from './coverage.ts';
import { parseRecordFile } from './parse.ts';
import type { Coverage, CoverageGap, Kind, Problem, RelationRule, SpecLink, SpecRecord, Workspace } from './types.ts';

export type * from './types.ts';

/** The folder holding the engine (lathe/), whatever root is being loaded. */
const ENGINE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CHECKS_DIR = path.join(ENGINE_DIR, 'checks');
const META_DIR = path.join(ENGINE_DIR, 'meta');

export interface LoadOptions {
  /** Folder of check SQL files. Defaults to lathe/checks. */
  checksDir?: string;
  /** Folder holding kinds.csv and relations.csv. Defaults to <root>/lathe/meta, then the engine's own meta folder. */
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

// Finds every specs/**/*.md except README.md, as paths relative to root, sorted.
async function findRecordFiles(root: string): Promise<string[]> {
  const specsDir = path.join(root, 'specs');
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

async function isFile(file: string | null): Promise<boolean> {
  if (!file) return false;
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
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

async function gatherFileFacts(root: string, records: LoadedRecord[]): Promise<FileFact[]> {
  const facts: FileFact[] = [];
  for (const r of records) {
    const field = r.kind === 'test' ? 'run_by' : r.kind === 'component' ? 'file' : null;
    const file = field ? r.fields[field]?.trim() : undefined;
    if (!file) continue;
    const resolved = resolveInside(root, file);
    const exists = await isFile(resolved);
    let containsId: boolean | null = null;
    if (r.kind === 'test') containsId = exists && r.id !== '' && (await readFile(resolved!, 'utf8')).includes(r.id);
    facts.push({ path: r.path, record: r.id, kind: r.kind, file, file_exists: exists, contains_id: containsId });
  }
  return facts;
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

async function loadMeta(connection: DuckDBConnection, metaDir: string) {
  const csv = (name: string) => `read_csv(${sqlString(path.join(metaDir, name))}, header = true, all_varchar = true)`;
  const list = (col: string) =>
    `CASE WHEN trim(coalesce(${col}, '')) = '' THEN []::VARCHAR[] ELSE string_split(regexp_replace(trim(${col}), '\\s+', ' ', 'g'), ' ') END AS ${col}`;
  await connection.run(`
    CREATE TABLE kinds AS
    SELECT trim(kind) AS kind, coalesce(label, '') AS label, coalesce(stage, '') AS stage,
           ${list('parent_kinds')}, ${list('required_fields')}, coalesce(description, '') AS description
    FROM ${csv('kinds.csv')};
    CREATE TABLE relations AS
    SELECT trim(relation) AS relation, trim(source_kind) AS source_kind, trim(target_kind) AS target_kind,
           coalesce(description, '') AS description
    FROM ${csv('relations.csv')};
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

async function computeCoverage(connection: DuckDBConnection): Promise<Coverage[]> {
  const counts = await readRows<Omit<Coverage, 'gaps'>>(connection, COVERAGE_COUNTS_SQL);
  const gaps = await readRows<CoverageGap & { domain: string }>(connection, COVERAGE_GAPS_SQL);
  return counts.map((c) => ({
    ...c,
    gaps: gaps.filter((g) => g.domain === c.domain).map(({ id, kind, missing }) => ({ id, kind, missing })),
  }));
}

/** Loads, checks and measures the spec workspace under root (the repo root). */
export async function loadWorkspace(root: string, options: LoadOptions = {}): Promise<Workspace> {
  root = path.resolve(root);
  const rootMeta = path.join(root, 'lathe', 'meta');
  const metaDir = options.metaDir ?? (existsSync(path.join(rootMeta, 'kinds.csv')) ? rootMeta : META_DIR);
  const checksDir = options.checksDir ?? CHECKS_DIR;
  const problems: Problem[] = [];

  const records: LoadedRecord[] = [];
  for (const file of await findRecordFiles(root)) {
    const result = parseRecordFile(await readFile(path.join(root, file), 'utf8'));
    if (!result.ok) {
      problems.push({ severity: 'error', check: 'parse-error', record: null, message: `${file} cannot be read: ${result.reason}.` });
      continue;
    }
    records.push({ ...result.record, product: null, domain: null, path: file });
  }
  placeRecords(records, problems);
  const facts = await gatherFileFacts(root, records);

  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  try {
    await loadMeta(connection, metaDir);
    await connection.run(`
      CREATE TABLE records (path VARCHAR, id VARCHAR, kind VARCHAR, title VARCHAR, parent VARCHAR,
                            product VARCHAR, domain VARCHAR, body VARCHAR);
      CREATE TABLE fields (path VARCHAR, record VARCHAR, name VARCHAR, value VARCHAR);
      CREATE TABLE links (path VARCHAR, source VARCHAR, relation VARCHAR, target VARCHAR);
      CREATE TABLE file_facts (path VARCHAR, record VARCHAR, kind VARCHAR, file VARCHAR,
                               file_exists BOOLEAN, contains_id BOOLEAN);
    `);
    await append(connection, 'records', records.map((r) => [r.path, r.id, r.kind, r.title, r.parent, r.product, r.domain, r.body]));
    await append(connection, 'fields', records.flatMap((r) => Object.entries(r.fields).map(([name, value]) => [r.path, r.id, name, value])));
    await append(connection, 'links', records.flatMap((r) => r.links.map((l) => [r.path, r.id, l.relation, l.target])));
    await append(connection, 'file_facts', facts.map((f) => [f.path, f.record, f.kind, f.file, f.file_exists, f.contains_id]));

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
