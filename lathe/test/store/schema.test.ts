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
      // One parent: a lone parent column is required; two are both optional, with a CHECK that exactly one is given.
      const columns = kind.parents.map((p) => table.columns.find((c) => c.name === p.column)!);
      if (columns.length === 1) expect(columns[0].required, kind.name).toBe(true);
      if (columns.length === 2) {
        expect(columns.map((c) => c.required), kind.name).toEqual([false, false]);
        expect(table.checks, kind.name).toContainEqual(expect.stringContaining(`(${columns[0].name} IS NULL) != (${columns[1].name} IS NULL)`));
      }
      expect(columns.length, kind.name).toBeLessThanOrEqual(2);
    }
  });

  it('has the kinds with no owner the plan names, each taking its product or domain from its ID', () => {
    const ownerless = Object.values(schema.kinds).filter((k) => !k.parents.length).map((k) => [k.name, k.idScope]);
    expect(ownerless.sort()).toEqual([
      ['integration', 'product'],
      ['product', null],
      ['specification', 'domain'],
      ['ui_component', 'product'],
      ['value_object', 'product'],
      ['view', 'product'],
    ]);
  });

  it('orders the kinds stage by stage, with product first and open questions last', () => {
    const stages = schema.stages.map((s) => s.name);
    expect(stages).toEqual(['domain-model', 'use-cases', 'interaction-design', 'technical-specification', 'test-plan']);
    const kinds = Object.values(schema.kinds).sort((a, b) => a.position! - b.position!);
    expect(kinds[0].name).toBe('product');
    expect(kinds.at(-1)!.name).toBe('question');
    const inner = kinds.slice(1, -1).map((k) => stages.indexOf(k.stage!));
    expect(inner).toEqual([...inner].sort((a, b) => a - b));
    expect(inner).not.toContain(-1);
    expect(kinds.map((k) => k.position)).toEqual(kinds.map((_, i) => i + 1));
  });

  it('makes each obligation kind a member of the obligation supertype', () => {
    const obligations = Object.values(schema.kinds).filter((k) => k.obligation).map((k) => k.name).sort();
    expect(obligations).toEqual(schema.supertypes.obligation);
    expect(obligations).toEqual(['api_requirement', 'constraint', 'domain_service', 'invariant', 'pattern_rule', 'policy', 'specification', 'standard_rule', 'uc_requirement', 'view_requirement']);
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

