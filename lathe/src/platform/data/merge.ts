// The merge driver for data files: a three-way merge by row key. It keeps both sides' changes against the base,
// sorts the rows again and checks the merged table's own rules. It never drops a field: the schema it runs with is
// this side's, which may not know a column the other side added, so a row keeps every field it has, and a table whose
// rows carry a column this schema does not know is checked when the merged data next loads, under the merged schema. A real clash (one key added on both sides with
// different content, or one row changed or removed on one side and changed on the other) fails, leaving conflict
// markers around each clashing row.
//
// Set up once per clone (see the repo README):
//   git config merge.lathe-data.name "Lathe data files"
//   git config merge.lathe-data.driver "node lathe/bin/lathe.ts merge-data %O %A %B %P"
// with .gitattributes holding: data/*.jsonl merge=lathe-data
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { insertRows, standaloneTableSql } from './insert.ts';
import { keyColumns, normalizeRow, rowKey, rowLine, sortRows, type Row } from './rows.ts';
import { applyMigrations, describeSchema, type SchemaDescription, type TableDescription } from './schema.ts';

export interface MergeResult {
  /** The merged file's text: the merged rows, sorted, with conflict markers around any clash. */
  text: string;
  /** Each real clash, in words. */
  clashes: string[];
  /** Rows of the merged table that break its own rules (columns, types, keys, checks). */
  problems: string[];
}

interface Side {
  line: string;
  row: Row;
}

// Reads one side's file into rows by key. A line that is not a JSON object is reported.
function readSide(text: string, table: TableDescription | null, label: string, problems: string[]): Map<string, Side> {
  const rows = new Map<string, Side>();
  text.split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      problems.push(`${label} line ${index + 1} is not one JSON object`);
      return;
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      problems.push(`${label} line ${index + 1} is not one JSON object`);
      return;
    }
    const row = value as Row;
    const known = table !== null && keyColumns(table).every((c) => c in row);
    const key = known ? rowKey(table, row) : 'id' in row ? String(row.id) : 'source_id' in row ? `${row.source_id}\u0000${row.target_id}` : line;
    rows.set(key, { line: table ? mergedLine(table, row) : JSON.stringify(row), row });
  });
  return rows;
}

// A row's line: the table's columns in order, then any field this schema does not know, by name, never dropped.
function mergedLine(table: TableDescription, row: Row): string {
  const columns = new Set(table.columns.map((c) => c.name));
  const unknown = Object.keys(row).filter((k) => !columns.has(k)).sort();
  if (!unknown.length) return rowLine(table, row);
  const ordered: Row = JSON.parse(rowLine(table, row));
  for (const k of unknown) ordered[k] = row[k];
  return JSON.stringify(ordered);
}

const unknownColumns = (table: TableDescription, rows: Row[]) => {
  const columns = new Set(table.columns.map((c) => c.name));
  return rows.some((row) => Object.keys(row).some((k) => !columns.has(k)));
};

const readable = (key: string) => key.replaceAll('\u0000', ' ');

/**
 * Merges three versions of one table's data file. `table` describes it, or is null for a table the schema does not
 * know (such as a product kind's), which is merged by its rows' id, or source_id and target_id, without checks.
 */
export async function mergeData(base: string, ours: string, theirs: string, table: TableDescription | null): Promise<MergeResult> {
  const problems: string[] = [];
  const b = readSide(base, table, 'the base', problems);
  const o = readSide(ours, table, 'our side', problems);
  const t = readSide(theirs, table, 'their side', problems);
  const clashes: string[] = [];
  const entries: { row: Row; key: string; lines: string[] }[] = [];
  for (const key of new Set([...b.keys(), ...o.keys(), ...t.keys()])) {
    const [was, mine, other] = [b.get(key), o.get(key), t.get(key)];
    let kept: Side | undefined;
    if (mine?.line === other?.line) kept = mine;
    else if (mine?.line === was?.line) kept = other;
    else if (other?.line === was?.line) kept = mine;
    else {
      const what = !was
        ? `${readable(key)} was added on both sides with different content`
        : !mine || !other
          ? `${readable(key)} was removed on one side and changed on the other`
          : `${readable(key)} was changed on both sides`;
      clashes.push(what);
      entries.push({
        row: (mine ?? other)!.row,
        key,
        lines: ['<<<<<<< ours', ...(mine ? [mine.line] : []), '=======', ...(other ? [other.line] : []), '>>>>>>> theirs'],
      });
      continue;
    }
    if (kept) entries.push({ row: kept.row, key, lines: [kept.line] });
  }
  const byRow = new Map(entries.map((e) => [e.row, e]));
  const sorted = table
    ? sortRows(table, entries.map((e) => e.row)).map((row) => byRow.get(row)!)
    : entries.sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
  const text = sorted.flatMap((e) => e.lines.map((l) => `${l}\n`)).join('');
  const rows = sorted.map((e) => e.row);
  if (table && !clashes.length && !problems.length && !unknownColumns(table, rows)) problems.push(...(await checkTable(table, rows)));
  return { text, clashes, problems };
}

// Checks one table's rows against its own rules: each row's columns and types, then its keys and CHECK constraints in
// a table with no foreign keys. Keys to other tables are checked when the whole data folder next loads.
async function checkTable(table: TableDescription, rows: Row[]): Promise<string[]> {
  const problems: string[] = [];
  const normalized: Row[] = [];
  for (const row of rows) {
    const result = normalizeRow(table, row);
    if ('problem' in result) problems.push(result.problem);
    else normalized.push(result.row);
  }
  if (problems.length || !normalized.length) return problems;
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  try {
    await connection.run(standaloneTableSql(table));
    await insertRows(connection, table, normalized);
  } catch (error) {
    problems.push(`the merged ${table.name} breaks a rule of its table: ${(error as Error).message.split('\n')[0]}`);
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
  return problems;
}

/** Lathe's own schema, described from the migrations. */
async function latheSchema(): Promise<SchemaDescription> {
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  try {
    await applyMigrations(connection);
    return await describeSchema(connection);
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

/**
 * The merge driver: merges the base (%O), ours (%A) and theirs (%B) versions of the data file at path (%P), and
 * writes the result over ours, as git expects. Returns the clashes and problems; none means a clean merge.
 */
export async function mergeDataFiles(basePath: string, oursPath: string, theirsPath: string, filePath: string): Promise<MergeResult> {
  const schema = await latheSchema();
  const name = path.basename(filePath, '.jsonl');
  const table = schema.tables[name]?.stored ? schema.tables[name] : null;
  const read = (file: string) => readFileSync(file, 'utf8');
  const result = await mergeData(read(basePath), read(oursPath), read(theirsPath), table);
  writeFileSync(oursPath, result.text);
  return result;
}
