// The TypeScript row types of Lathe's stored tables, generated from the schema description into tables.ts, so the
// CLI, the app's forms and the plugin read the same columns the migrations make.
import type { ColumnDescription, SchemaDescription } from './schema.ts';

const pascal = (name: string) => name.replace(/(^|_)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());

function tsType(column: ColumnDescription): string {
  switch (column.kind) {
    case 'text':
    case 'date':
      return 'string';
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'text_list':
      return 'string[]';
    case 'enum':
      return column.values!.map((v) => JSON.stringify(v)).join(' | ');
  }
}

const comment = (text: string | null, indent: string) => (text ? `${indent}/** ${text.replaceAll('*/', '* /')} */\n` : '');

/** The tables.ts file: one row interface per stored table, and the stored table names in load order. */
export function renderTableTypes(schema: SchemaDescription): string {
  const out = [
    '// Generated from lathe/schema/ by `npm --prefix lathe run schema`; do not edit by hand.',
    '// One interface per stored table: a row as its data file holds it, with the columns in their fixed order.',
    '',
  ];
  for (const name of schema.loadOrder) {
    const table = schema.tables[name];
    out.push(`${comment(table.description, '')}export interface ${pascal(name)}Row {`);
    for (const column of table.columns) {
      out.push(`${comment(column.description, '  ')}  ${/^[a-z_][a-z0-9_]*$/.test(column.name) ? column.name : JSON.stringify(column.name)}${column.required ? '' : '?'}: ${tsType(column)};`);
    }
    out.push('}', '');
  }
  out.push('/** Each stored table\'s row type, by table name. */', 'export interface TableRows {');
  for (const name of schema.loadOrder) out.push(`  ${name}: ${pascal(name)}Row;`);
  out.push('}', '', '/** A stored table of Lathe\'s schema. */', 'export type TableName = keyof TableRows;', '');
  return out.join('\n');
}
