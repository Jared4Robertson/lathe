// The schema: numbered migrations applied in order, every table and column described, the generated row types up to
// date.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { describe, expect, it } from 'vitest';
import { applyMigrations, describeSchema, PACKAGE_DIR, readMigrations } from '../../src/index.ts';
import { renderTableTypes } from '../../src/store/types-file.ts';

const instance = await DuckDBInstance.create(':memory:');
const connection = await instance.connect();
await applyMigrations(connection);
const schema = await describeSchema(connection);

describe('the migrations', () => {
  it('are numbered in order and recorded as applied', async () => {
    const migrations = readMigrations();
    expect(migrations.map((m) => m.version)).toEqual(migrations.map((_, i) => i + 1));
    const applied = (await connection.runAndReadAll('SELECT version, name FROM meta_migration ORDER BY version')).getRowObjectsJson();
    expect(applied).toEqual(migrations.map((m) => ({ version: m.version, name: m.name })));
  });
});

describe('the schema description', () => {
  it('describes every table and every column of a stored table', () => {
    for (const table of Object.values(schema.tables)) {
      expect(table.description, table.name).toBeTruthy();
      if (!table.stored || table.role === 'link') continue;
      for (const column of table.columns) expect(column.description, `${table.name}.${column.name}`).toBeTruthy();
    }
  });

  it('gives every kind an id in the registry, a title and its parent columns', () => {
    for (const kind of Object.values(schema.kinds)) {
      const table = schema.tables[kind.name];
      expect(table.primaryKey).toEqual(['id']);
      expect(table.foreignKeys).toContainEqual({ columns: ['id'], table: 'record_id', references: ['id'] });
      expect(table.columns.find((c) => c.name === 'title')?.required, kind.name).toBe(true);
      for (const parent of kind.parents) {
        const fk = table.foreignKeys.find((f) => f.columns[0] === parent.column && f.table === parent.kind);
        expect(fk, `${kind.name}.${parent.column} -> ${parent.kind}`).toBeTruthy();
      }
      // At least one parent column is required, so every record but a product sits somewhere.
      if (kind.name !== 'product') expect(kind.parents.some((p) => table.columns.find((c) => c.name === p.column)!.required), kind.name).toBe(true);
    }
  });

  it("fits each relation's pairs to its link table's ends", () => {
    const fits = (end: string, kind: string) => end === 'record_id' || end === kind || schema.supertypes[end]?.includes(kind);
    for (const relation of Object.values(schema.relations)) {
      expect(relation.pairs.length, relation.name).toBeGreaterThan(0);
      for (const pair of relation.pairs) {
        expect(fits(relation.sourceTable, pair.source), `${relation.name} ${pair.source}`).toBe(true);
        expect(pair.target === '*' ? relation.targetTable === 'record_id' : fits(relation.targetTable, pair.target), `${relation.name} ${pair.target}`).toBe(true);
      }
    }
    for (const [supertype, members] of Object.entries(schema.supertypes)) {
      for (const member of members) expect(schema.kinds[member], `${supertype} ${member}`).toBeTruthy();
    }
  });

  it('lists the stored tables in an order where each comes after the tables it points at', () => {
    const seen = new Set<string>();
    for (const name of schema.loadOrder) {
      for (const fk of schema.tables[name].foreignKeys) {
        if (fk.table !== name && schema.tables[fk.table].stored) expect(seen.has(fk.table), `${name} -> ${fk.table}`).toBe(true);
      }
      seen.add(name);
    }
  });

  it('matches the generated row types in src/store/tables.ts (npm run schema)', () => {
    const file = readFileSync(path.join(PACKAGE_DIR, 'src', 'store', 'tables.ts'), 'utf8');
    expect(file).toBe(renderTableTypes(schema));
  });
});

// Until the engine's cutover deletes lathe/meta/, the schema holds the same meta-model.
