// Putting rows into a DuckDB table: one JSON parameter per chunk of rows, read with every column's type, so the
// database's own keys and checks judge each row.
import type { DuckDBConnection } from '@duckdb/node-api';
import type { Row } from './rows.ts';
import { sqlName, sqlString, type TableDescription } from './schema.ts';

const INSERT_CHUNK = 5000;

// The SQL type from_json reads a column as; enums are read as text and cast on insert.
const jsonType = (sqlType: string) => (sqlType.startsWith('ENUM(') ? 'VARCHAR' : sqlType);

/** Inserts the rows into the table on the connection's current database. */
export async function insertRows(connection: DuckDBConnection, table: TableDescription, rows: Row[]): Promise<void> {
  const shape = `[{${table.columns.map((c) => `${JSON.stringify(c.name)}:${JSON.stringify(jsonType(c.sqlType))}`).join(',')}}]`;
  const columns = table.columns.map((c) => sqlName(c.name));
  const insert = `INSERT INTO ${sqlName(table.name)} (${columns.join(', ')}) SELECT ${columns.map((c) => `r.${c}`).join(', ')} FROM (SELECT unnest(from_json(`;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    await connection.run(`${insert}${sqlString(JSON.stringify(rows.slice(i, i + INSERT_CHUNK)))}::JSON, ${sqlString(shape)})) AS r)`);
  }
}

/** The CREATE TABLE for a table's own rules (columns, types, required columns, keys and checks) without its foreign
 *  keys, for checking one table's rows apart from the others. */
export function standaloneTableSql(table: TableDescription): string {
  const parts = table.columns.map((c) => `${sqlName(c.name)} ${c.sqlType}${c.required ? ' NOT NULL' : ''}`);
  if (table.primaryKey.length) parts.push(`PRIMARY KEY (${table.primaryKey.map(sqlName).join(', ')})`);
  for (const unique of table.unique) parts.push(`UNIQUE (${unique.map(sqlName).join(', ')})`);
  for (const check of table.checks) parts.push(`CHECK (${check})`);
  return `CREATE TABLE ${sqlName(table.name)} (${parts.join(', ')})`;
}
