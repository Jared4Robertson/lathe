// The commands of the table aggregate, run on a store as the CLI, the MCP tools and HTTP run them. Its cases are proved by
// LA-PAT-AGGREGATE-COMMANDS-R10-T01, which runs them from lathe/test/authoring/aggregate/aggregate-commands.test.ts.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { expect, it } from 'vitest';
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
import { StoreError } from '../../../src/platform/data/problems.ts';
import { type Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';
import { domainModelBase } from '../domain-model-base.ts';
import { AROUND, tableDataSet } from './data-set.ts';

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

const fileOf = (store: Store, table: string) => readFileSync(path.join(store.dataDir, `${table}.jsonl`), 'utf8');
const primary = { type: 'primary', columns: ['id'] };

export function tableCommandCases(): void {
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
    expect((await runCommand(store, MOVE_TABLE, { id: 'TL-LEND-TB01', entity_id: 'TL-LEND-EN01' }).catch((e: StoreError) => e.problems[0].rule))).toBe('one-table-each');
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
}
