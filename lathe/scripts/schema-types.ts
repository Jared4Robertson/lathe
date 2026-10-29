// Writes src/platform/data/tables.ts, the row types of Lathe's stored tables, from the migrations in schema/.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { applyMigrations, describeSchema } from '../src/platform/data/schema.ts';
import { renderTableTypes } from '../src/platform/data/types-file.ts';

const instance = await DuckDBInstance.create(':memory:');
const connection = await instance.connect();
await applyMigrations(connection);
const file = path.join(import.meta.dirname, '..', 'src', 'platform', 'data', 'tables.ts');
writeFileSync(file, renderTableTypes(await describeSchema(connection)));
connection.closeSync();
instance.closeSync();
console.log(`Wrote ${path.relative(process.cwd(), file)}`);
