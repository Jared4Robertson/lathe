// Rows as the store holds them: one plain object per row, with only the columns that have a value. Here are the
// checks a value must pass before the database sees it, a row's key, and the deterministic order and line format of
// the data files.
import type { ColumnDescription, TableDescription } from './schema.ts';

/** One column's value: text, a whole number, true/false, or a list of texts. A missing column is none (NULL). */
export type Value = string | number | boolean | string[];
export type Row = Record<string, Value>;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function validDate(text: string): boolean {
  const m = DATE.exec(text);
  if (!m) return false;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.getUTCFullYear() === Number(m[1]) && date.getUTCMonth() === Number(m[2]) - 1 && date.getUTCDate() === Number(m[3]);
}

/** Why a value does not fit its column, or null when it fits. */
function valueProblem(column: ColumnDescription, value: unknown): string | null {
  switch (column.kind) {
    case 'text':
      if (typeof value !== 'string') return 'is not text';
      if (value.trim() === '') return 'is empty; leave the column out instead';
      return null;
    case 'enum':
      if (typeof value !== 'string' || !column.values!.includes(value)) return `is not one of ${column.values!.join(', ')}`;
      return null;
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value) || Math.abs(value) > 2 ** 31 - 1) return 'is not a whole number';
      return null;
    case 'boolean':
      return typeof value === 'boolean' ? null : 'is not true or false';
    case 'date':
      return typeof value === 'string' && validDate(value) ? null : 'is not a date written YYYY-MM-DD';
    case 'text_list':
      return Array.isArray(value) && value.every((v) => typeof v === 'string' && v.trim() !== '') ? null : 'is not a list of texts';
  }
}

/**
 * Checks a row against its table's columns: every column known, every value of its column's type, every required
 * column given. Returns the row with its columns in the table's order, or the first problem found. Keys, foreign
 * keys and CHECK constraints are the database's to enforce.
 */
export function normalizeRow(table: TableDescription, input: unknown): { row: Row } | { problem: string } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { problem: `a row of ${table.name} is a JSON object` };
  const given = input as Record<string, unknown>;
  const names = new Set(table.columns.map((c) => c.name));
  const unknown = Object.keys(given).filter((name) => !names.has(name));
  if (unknown.length) {
    return { problem: `${table.name} has no column ${unknown.map((u) => `"${u}"`).join(', ')}; its columns are ${table.columns.map((c) => c.name).join(', ')}` };
  }
  const row: Row = {};
  for (const column of table.columns) {
    const value = given[column.name];
    if (value === undefined || value === null) {
      if (column.required) return { problem: `${table.name}.${column.name} is required` };
      continue;
    }
    const problem = valueProblem(column, value);
    if (problem) return { problem: `${table.name}.${column.name} ${JSON.stringify(value)} ${problem}` };
    row[column.name] = value as Value;
  }
  return { row };
}

/** The columns that identify a row: its primary key. */
const keyColumns = (table: TableDescription): string[] => table.primaryKey;

/** A row's key as one string, for maps: its primary key's values joined. */
export const rowKey = (table: TableDescription, row: Row): string => keyColumns(table).map((c) => String(row[c] ?? '')).join('\u0000');

/** A row's key as people read it, such as TL-LEND-UC01 or TL-LEND-EN01, position 2. */
export function describeKey(table: TableDescription, row: Row): string {
  const columns = keyColumns(table);
  if (columns.length === 1) return String(row[columns[0]]);
  return columns.map((c) => `${c} ${row[c]}`).join(', ');
}

// Compares two values of one column: numbers as numbers, everything else as text by code point.
function compareValues(a: Value | undefined, b: Value | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Sorts rows by their key columns, as a data file holds them. */
export function sortRows(table: TableDescription, rows: Row[]): Row[] {
  const columns = keyColumns(table);
  return [...rows].sort((a, b) => {
    for (const c of columns) {
      const order = compareValues(a[c], b[c]);
      if (order) return order;
    }
    return 0;
  });
}

/** One row as its data file's line: a JSON object with its columns in the table's order and none left out as null. */
export function rowLine(table: TableDescription, row: Row): string {
  const ordered: Row = {};
  for (const column of table.columns) if (row[column.name] !== undefined) ordered[column.name] = row[column.name];
  return JSON.stringify(ordered);
}

/** A table's whole data file: its rows sorted by key, one JSON object per line, with a trailing newline. */
export function tableText(table: TableDescription, rows: Row[]): string {
  return sortRows(table, rows).map((row) => `${rowLine(table, row)}\n`).join('');
}
