// The Table aggregate's commands, queries and refusals (LA-AUT-A18), run on a store as the CLI, the MCP tools and the
// HTTP API run them: each command changes one table through TableRepository, holds it to its rules before it saves,
// and is refused with its reason, changing nothing. Its rules are run on every load too.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_TABLE } from '../../../src/authoring/table/commands/add-table.ts';
import { CHANGE_TABLE } from '../../../src/authoring/table/commands/change-table.ts';
import { MOVE_TABLE } from '../../../src/authoring/table/commands/move-table.ts';
import { REMOVE_TABLE } from '../../../src/authoring/table/commands/remove-table.ts';
import { GET_TABLE, LIST_TABLES, NEXT_TABLE_ID } from '../../../src/authoring/table/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError, type StoreProblem } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import type { Row } from '../../../src/platform/data/rows.ts';
import { writeData, type Data } from '../../helpers.ts';
import { closeOpenStores, domainModelBase } from '../domain-model-base.ts';
import { AROUND, tableDataSet } from './data-set.ts';

afterEach(closeOpenStores);

/** The refusal a command gets, or a failure when it is not refused. */
async function refusal(store: Store, definition: AnyCommand, input: unknown): Promise<StoreError> {
  try {
    await runCommand(store, definition, input);
  } catch (error) {
    if (error instanceof StoreError) return error;
    throw error;
  }
  throw new Error(`${definition.name} was not refused`);
}

/** The problems loading the data files is refused with, or none when they load. */
async function loading(data: Data): Promise<StoreProblem[]> {
  try {
    await (await openStore(writeData(data), { latheDataDir: null })).close();
    return [];
  } catch (error) {
    if (error instanceof StoreError) return error.problems;
    throw error;
  }
}

/** The data set's tables and keys as data files, with the rows given in place of a table's own or added to them. */
async function dataFiles(change: (data: Data) => void): Promise<Data> {
  const store = await tableDataSet();
  const data = domainModelBase({ ...AROUND, table: store.rows('table'), table_key: store.rows('table_key') });
  change(data);
  return data;
}

const fileOf = (store: Store, table: string) => readFileSync(path.join(store.dataDir, `${table}.jsonl`), 'utf8');
const primary = { type: 'primary', columns: ['id'] };

describe('LA-AUT-UC17-R50-T01 each Table command (LA-AUT-A18) changes one table through TableRepository, held to its rules, and is reached by name from the CLI, the MCP tools and HTTP', () => {
  it('builds the data set with its own Add commands, and reads a table whole', async () => {
    const store = await tableDataSet();
    const whole = runQuery(store, GET_TABLE, { id: 'TL-LEND-EN01-TB' }) as ReturnType<typeof GET_TABLE.run>;
    expect(whole).toMatchObject({ record: { id: 'TL-LEND-EN01-TB', kind: 'table' }, table: { id: 'TL-LEND-EN01-TB' }, parent: { kind: 'entity', id: 'TL-LEND-EN01' }, meets: ['TL-STD-CODE-R01'], packages: [] });
    expect(whole.keys).toEqual([{ table_id: 'TL-LEND-EN01-TB', position: 1, ...primary }, { table_id: 'TL-LEND-EN01-TB', position: 2, type: 'unique', columns: ['tool_id'], name: 'loans_one_active_per_tool', invariant_id: 'TL-LEND-INV01', condition: 'returned_at IS NULL' }]);
    expect(GET_TABLE.text(whole)).toContain('key 2: unique (tool_id) loans_one_active_per_tool; enforces TL-LEND-INV01; where returned_at IS NULL');
    expect(runQuery(store, LIST_TABLES, { parent: 'TL-LEND' })).toEqual([{ id: 'TL-LEND-TB01', title: 'outbox' }]);
    expect(runQuery(store, LIST_TABLES, { parent: 'TL-LEND-EN01' })).toEqual([{ id: 'TL-LEND-EN01-TB', title: 'loans' }]);
    expect(runQuery(store, NEXT_TABLE_ID, { parent: 'TL-LEND' })).toBe('TL-LEND-TB02');
    expect(() => runQuery(store, NEXT_TABLE_ID, { parent: 'TL-LEND-EN01' })).toThrow(/already has its table, TL-LEND-EN01-TB/);
    expect(() => runQuery(store, NEXT_TABLE_ID, { parent: 'TL-LEND-A1' })).toThrow(/a table sits under an entity, a read model or a domain, and TL-LEND-A1 is an aggregate/);
  });

  it('changes a table and moves it to another parent, writing only its own tables', async () => {
    const store = await tableDataSet();
    expect((await runCommand(store, CHANGE_TABLE, { id: 'TL-LEND-TB01', keys: [primary], packages: ['kysely'] })).tables).toEqual(['package_use', 'table_key']);
    expect((await runCommand(store, CHANGE_TABLE, { id: 'TL-LEND-EN01-TB', file: null })).tables).toEqual(['table']);
    expect((await runCommand(store, MOVE_TABLE, { id: 'TL-LEND-TB01', entity_id: 'TL-LEND-EN01' }).catch((e: StoreError) => e.problems[0].rule))).toBe('unique');
    const moved = await runCommand(store, MOVE_TABLE, { id: 'TL-CAT-EN01-TB', domain_id: 'TL-CAT' });
    expect(moved.tables).toEqual(['table']);
    expect(store.record('TL-CAT-EN01-TB')?.row).toMatchObject({ domain_id: 'TL-CAT' });
    expect(store.record('TL-CAT-EN01-TB')?.row).not.toHaveProperty('entity_id');
  });

  it("refuses a parent that is not exactly one, an input that is not the command's, and a record that is not there, changing no file", async () => {
    const store = await tableDataSet();
    const before = fileOf(store, 'table');
    expect((await refusal(store, ADD_TABLE, { id: 'TL-LEND-TB02', title: 'cache', name: 'cache', storage: 'table' })).problems[0]).toMatchObject({ rule: 'parent', message: 'table TL-LEND-TB02 sits under exactly one entity, read model or domain; 0 are given' });
    expect((await refusal(store, MOVE_TABLE, { id: 'TL-LEND-TB01', domain_id: 'TL-CAT', entity_id: 'TL-CAT-EN01' })).problems[0].rule).toBe('parent');
    expect((await refusal(store, MOVE_TABLE, { id: 'TL-LEND-TB01', domain_id: 'TL-LEND' })).problems[0]).toMatchObject({ rule: 'parent', message: 'TL-LEND-TB01 is already under TL-LEND' });
    await expect(runCommand(store, CHANGE_TABLE, { id: 'TL-LEND-TB01', domain_id: 'TL-CAT' })).rejects.toThrow(/change-table takes no domain_id/);
    expect((await refusal(store, REMOVE_TABLE, { id: 'TL-LEND-TB09' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no table TL-LEND-TB09' });
    expect(fileOf(store, 'table')).toBe(before);
  });

  it('runs `lathe table <command>`, the table_ tools and POST /api/table/<command>', async () => {
    const root = writeData(domainModelBase(AROUND));
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    expect(await runAggregateCommand(['table', 'add-table', '--id', 'TL-LEND-EN01-TB', '--title', 'loans', '--entity_id', 'TL-LEND-EN01', '--name', 'loans', '--storage', 'table', '--keys', '{"type":"primary","columns":["id"]}', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added table_key table_id TL-LEND-EN01-TB, position 1');
    expect((await callTool(root, 'table_add_table', { id: 'TL-LEND-TB01', title: 'outbox', domain_id: 'TL-LEND', name: 'outbox', storage: 'table' })).isError).toBeUndefined();
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const post = (route: string, body: unknown) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/table/remove-table', { id: 'TL-LEND-TB01' })).status).toBe(200);
      expect((await post('/api/table/move-table', { id: 'TL-LEND-TB09', domain_id: 'TL-LEND' })).status).toBe(422);
      expect((await post('/api/table/add-table', { id: 'TL-LEND-TB02', colour: 'red' })).status).toBe(400);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("LA-AUT-INV13-T a table for an entity stored in its root's table is refused, and so is an entity's table that is a view or a materialized view", () => {
  it('refuses Add a table for it, with its reason, and changes no file', async () => {
    const store = await tableDataSet();
    const before = fileOf(store, 'table');
    expect((await refusal(store, ADD_TABLE, { id: 'TL-LEND-EN02-TB', title: 'returns', entity_id: 'TL-LEND-EN02', name: 'returns', storage: 'table' })).problems).toEqual([
      expect.objectContaining({ rule: 'entity-table', message: "entity TL-LEND-EN02 is stored in its root's table (in_root_table), so it cannot have table TL-LEND-EN02-TB of its own" }),
    ]);
    expect((await refusal(store, CHANGE_TABLE, { id: 'TL-LEND-EN01-TB', storage: 'view' })).problems[0]).toMatchObject({ rule: 'check', table: 'table' });
    expect(fileOf(store, 'table')).toBe(before);
  });

  it("refuses data files with such a table, a root stored in a root's table, or an entity's table that is a view, when they are loaded", async () => {
    const own = await loading(await dataFiles((d) => d.table.push({ id: 'TL-LEND-EN02-TB', title: 'returns', entity_id: 'TL-LEND-EN02', name: 'returns', storage: 'table' })));
    expect(own).toEqual([expect.objectContaining({ rule: 'entity-table', key: 'TL-LEND-EN02-TB', file: 'data/table.jsonl' })]);
    expect(await loading(await dataFiles((d) => (d.entity[0] = { ...d.entity[0], in_root_table: true })))).toEqual([expect.objectContaining({ rule: 'check', table: 'entity' })]);
    for (const storage of ['view', 'materialized view']) {
      expect(await loading(await dataFiles((d) => (d.table = d.table.map((t) => (t.id === 'TL-CAT-EN01-TB' ? { ...t, storage } : t))))), storage).toEqual([expect.objectContaining({ rule: 'check', table: 'table' })]);
    }
  });
});

describe("LA-AUT-INV14-T a table's second primary key is refused, and so is a key whose parts do not fit its type", () => {
  it('refuses Change a table with two primary keys, with its reason, and changes no file', async () => {
    const store = await tableDataSet();
    const before = fileOf(store, 'table_key');
    expect((await refusal(store, CHANGE_TABLE, { id: 'TL-LEND-TB01', keys: [primary, { type: 'primary', columns: ['loan_id'] }] })).problems).toEqual([
      expect.objectContaining({ rule: 'one-primary-key', message: 'table TL-LEND-TB01 has 2 primary keys; a table has one' }),
    ]);
    expect(fileOf(store, 'table_key')).toBe(before);
  });

  it("refuses data files with a second primary key, or a key's misplaced parts, when they are loaded", async () => {
    const two = await loading(await dataFiles((d) => d.table_key.push({ table_id: 'TL-LEND-EN01-TB', position: 3, type: 'primary', columns: ['tool_id'] })));
    expect(two).toEqual([expect.objectContaining({ rule: 'one-primary-key', key: 'TL-LEND-EN01-TB' })]);
    for (const bad of [
      { type: 'index', columns: ['id'], condition: 'x IS NULL' },
      { type: 'primary', columns: ['id'], invariant_id: 'TL-LEND-INV01' },
      { type: 'foreign', columns: ['id'] },
      { type: 'index', columns: ['id'], target_table_id: 'TL-LEND-TB01' },
    ] as Row[]) {
      const problems = await loading(await dataFiles((d) => (d.table_key = d.table_key.map((k) => (k.table_id === 'TL-CAT-EN01-TB' ? { table_id: 'TL-CAT-EN01-TB', position: 1, ...bad } : k)))));
      expect(problems, JSON.stringify(bad)).toEqual([expect.objectContaining({ rule: 'check', table: 'table_key' })]);
    }
  });
});

describe("LA-AUT-INV81-T a table's foreign key to another domain's table is refused", () => {
  it('refuses Change a table with it, with its reason, and changes no file; and the data files when they are loaded', async () => {
    const store = await tableDataSet();
    const before = fileOf(store, 'table_key');
    expect((await refusal(store, CHANGE_TABLE, { id: 'TL-CAT-EN01-TB', keys: [primary, { type: 'foreign', columns: ['loan_id'], target_table_id: 'TL-LEND-EN01-TB' }] })).problems).toEqual([
      expect.objectContaining({ rule: 'foreign-key-crosses-domain', message: 'table TL-CAT-EN01-TB is in domain TL-CAT, so its foreign key cannot point at table TL-LEND-EN01-TB, which is in domain TL-LEND' }),
    ]);
    expect(fileOf(store, 'table_key')).toBe(before);
    const crossing = await loading(await dataFiles((d) => d.table_key.push({ table_id: 'TL-CAT-EN01-TB', position: 2, type: 'foreign', columns: ['loan_id'], target_table_id: 'TL-LEND-EN01-TB' })));
    expect(crossing).toEqual([expect.objectContaining({ rule: 'foreign-key-crosses-domain', table: 'table_key', file: 'data/table_key.jsonl' })]);
  });
});

describe('LA-AUT-INV82-T a key of a table kept outside a database, or a foreign key to one, is refused', () => {
  it('refuses Change a table to a storage outside a database while it has keys, and a foreign key to such a table, changing no file', async () => {
    const store = await tableDataSet();
    const before = fileOf(store, 'table_key');
    for (const storage of ['browser storage', 'file', 'in memory']) {
      expect((await refusal(store, CHANGE_TABLE, { id: 'TL-CAT-EN01-TB', storage })).problems, storage).toEqual([
        expect.objectContaining({ rule: 'key-outside-database', message: `table TL-CAT-EN01-TB is kept in ${storage}, not in a database, so it has no keys` }),
      ]);
    }
    expect(fileOf(store, 'table_key')).toBe(before);
    await runCommand(store, CHANGE_TABLE, { id: 'TL-CAT-EN01-TB', storage: 'file', keys: [] });
    expect((await refusal(store, CHANGE_TABLE, { id: 'TL-LEND-EN01-TB', storage: 'file' })).problems.map((p) => p.rule)).toEqual(['key-outside-database', 'key-outside-database']);
    expect((await refusal(store, CHANGE_TABLE, { id: 'TL-LEND-TB01', keys: [primary, { type: 'foreign', columns: ['listing_id'], target_table_id: 'TL-CAT-EN01-TB' }] })).problems.map((p) => p.rule)).toEqual(['key-outside-database', 'foreign-key-crosses-domain']);
    expect(fileOf(store, 'table_key')).not.toContain('listing_id');
  });

  it('refuses data files with a key of or to a table outside a database, and loads them once the keys are gone', async () => {
    for (const storage of ['browser storage', 'file', 'in memory']) {
      const outside = await dataFiles((d) => (d.table = d.table.map((t) => (t.id === 'TL-LEND-EN01-TB' ? { ...t, storage } : t))));
      // Its own two keys, and the outbox's foreign key that points at it.
      expect((await loading(outside)).map((p) => p.rule), storage).toEqual(['key-outside-database', 'key-outside-database', 'key-outside-database']);
      outside.table_key = outside.table_key.filter((k) => k.table_id !== 'TL-LEND-EN01-TB' && k.target_table_id !== 'TL-LEND-EN01-TB');
      expect(await loading(outside), storage).toEqual([]);
    }
  });
});

describe('LA-STD-CODE-R07-T53 a table is removed whole, refused while anything outside references it', () => {
  it('removes a table with its keys and links, and refuses one another table points at, naming it', async () => {
    const store = await tableDataSet();
    expect((await refusal(store, REMOVE_TABLE, { id: 'TL-LEND-EN01-TB' })).problems[0].message).toBe('Table TL-LEND-EN01-TB is referenced, so it stays: table_key table_id TL-LEND-TB01, position 2 (target_table_id)');
    expect((await runCommand(store, REMOVE_TABLE, { id: 'TL-LEND-TB01' })).changes.map((c) => c.table).sort()).toEqual(['table', 'table_key', 'table_key']);
    expect((await runCommand(store, REMOVE_TABLE, { id: 'TL-LEND-EN01-TB' })).changes.map((c) => c.table).sort()).toEqual(['meets', 'table', 'table_key', 'table_key']);
  });
});
