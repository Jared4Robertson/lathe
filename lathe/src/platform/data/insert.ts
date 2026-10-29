// Putting rows into a DuckDB table so the database's own keys and checks judge each row: through an appender, or as
// one JSON parameter per chunk of rows, read with every column's type.
import { LIST, VARCHAR, type DuckDBConnection } from '@duckdb/node-api';
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

const TEXT_LIST = LIST(VARCHAR);

/**
 * Appends the rows to the table in the given database, through an appender: the database judges every key, foreign
 * key, CHECK and NOT NULL as insertRows does, without reading the rows back from JSON (several times faster). Its
 * refusals say less about the row, so a caller that needs to name the row runs insertRows after a refusal.
 */
export async function appendRows(connection: DuckDBConnection, database: string, table: TableDescription, rows: Row[]): Promise<void> {
  const appender = await connection.createAppender(table.name, 'main', database);
  try {
    for (const row of rows) {
      for (const column of table.columns) {
        const value = row[column.name];
        if (value === undefined) appender.appendNull();
        else if (column.kind === 'integer') appender.appendInteger(value as number);
        else if (column.kind === 'boolean') appender.appendBoolean(value as boolean);
        else if (column.kind === 'text_list') appender.appendList(value as string[], TEXT_LIST);
        // Text, and enums and dates written as text, which the appender casts to the column's type.
        else appender.appendVarchar(value as string);
      }
      appender.endRow();
    }
    appender.flushSync();
  } finally {
    appender.closeSync();
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
