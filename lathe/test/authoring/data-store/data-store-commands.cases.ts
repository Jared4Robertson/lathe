// The commands of the data-store aggregate, run on a store as the CLI, the MCP tools and HTTP run them. Its cases are proved by
// LA-PAT-AGGREGATE-COMMANDS-R10-T01, which runs them from lathe/test/authoring/aggregate/aggregate-commands.test.ts.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { expect, it } from 'vitest';
import { ADD_DATA_STORE } from '../../../src/authoring/data-store/commands/add-data-store.ts';
import { CHANGE_DATA_STORE } from '../../../src/authoring/data-store/commands/change-data-store.ts';
import { REMOVE_DATA_STORE } from '../../../src/authoring/data-store/commands/remove-data-store.ts';
import { GET_DATA_STORE, LIST_DATA_STORES, NEXT_DATA_STORE_ID } from '../../../src/authoring/data-store/queries.ts';
import { CHANGE_REPOSITORY } from '../../../src/authoring/domain/commands/change-repository.ts';
import { ADD_READER } from '../../../src/authoring/read-model/commands/add-reader.ts';
import { CHANGE_TABLE } from '../../../src/authoring/table/commands/change-table.ts';
import { REMOVE_PROVIDER } from '../../../src/traceability/provision/commands/remove-provider.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';
import { domainModelBase, storeOn } from '../domain-model-base.ts';
import { AROUND, dataStoreDataSet } from './data-set.ts';

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

export function dataStoreCommandCases(): void {
  it('builds the data set with its own Add command, and reads a data store whole with what is stored in it', async () => {
    const store = await dataStoreDataSet();
    expect(runQuery(store, GET_DATA_STORE, { id: 'TL-STORE01' })).toEqual({
      store: { id: 'TL-STORE01', title: 'DATABASE_URL', product_id: 'TL', kind: 'database', description: "The library's PostgreSQL database, run by the database host and reached at DATABASE_URL." },
      parent: { id: 'TL', kind: 'product', title: 'Tool Library' },
      providedBy: { id: 'TL-INT01', kind: 'integration', title: 'Database host' },
      stores: [{ id: 'TL-LEND-EN01-TB', kind: 'table', title: 'Loans' }, { id: 'TL-LEND-REPO01', kind: 'repository', title: 'LoanRepository' }],
    });
    expect(GET_DATA_STORE.text(runQuery(store, GET_DATA_STORE, { id: 'TL-STORE01' }) as ReturnType<typeof GET_DATA_STORE.run>)).toContain('provided by: TL-INT01 (Database host)');
    expect(runQuery(store, LIST_DATA_STORES, { parent: 'TL' })).toEqual([
      { id: 'TL-LEND-STORE01', title: 'localStorage', kind: 'browser storage' },
      { id: 'TL-STORE01', title: 'DATABASE_URL', kind: 'database' },
    ]);
    expect(runQuery(store, LIST_DATA_STORES, { parent: 'TL-LEND' })).toEqual([{ id: 'TL-LEND-STORE01', title: 'localStorage', kind: 'browser storage' }]);
    expect(runQuery(store, NEXT_DATA_STORE_ID, { kind: 'data_store', parent: 'TL' })).toBe('TL-STORE02');
    expect(() => runQuery(store, NEXT_DATA_STORE_ID, { kind: 'data_store', parent: 'TL-LEND-A1' })).toThrow(/a data_store sits under a product or a domain, and TL-LEND-A1 is an aggregate/);
  });

  it('changes a data store and the store a repository, reader or table names, each writing only its own tables', async () => {
    const store = await dataStoreDataSet();
    expect((await runCommand(store, REMOVE_PROVIDER, { record_id: 'TL-STORE01' })).tables).toEqual(['provided_by']);
    expect((await runCommand(store, CHANGE_DATA_STORE, { id: 'TL-LEND-STORE01', kind: 'memory', description: 'Kept while the page is open.' })).tables).toEqual(['data_store']);
    expect((await runCommand(store, CHANGE_REPOSITORY, { id: 'TL-LEND-REPO01', stored_in: 'TL-LEND-STORE01' })).tables).toEqual(['stored_in']);
    expect((await runCommand(store, CHANGE_TABLE, { id: 'TL-LEND-EN01-TB', stored_in: null })).tables).toEqual(['stored_in']);
    const readModel = await storeOn(domainModelBase({ ...AROUND, read_model: [{ id: 'TL-LEND-RM01', title: 'Overdue loans', domain_id: 'TL-LEND', description: 'Late loans.' }], data_store: [{ id: 'TL-STORE01', title: 'DATABASE_URL', product_id: 'TL', kind: 'database', description: 'The database.' }] }));
    expect((await runCommand(readModel, ADD_READER, { id: 'TL-LEND-RM01-RD', title: 'OverdueLoansReader', read_model_id: 'TL-LEND-RM01', description: 'Reads the view.', stored_in: 'TL-STORE01' })).tables).toEqual(['reader', 'stored_in']);
  });

  it("refuses a store under no parent or two, a second store for a repository, an input that is not the command's, and a removal while stored in, changing no file", async () => {
    const store = await dataStoreDataSet();
    const before = fileOf(store, 'data_store');
    expect((await refusal(store, ADD_DATA_STORE, { id: 'TL-STORE02', title: 'bucket', product_id: 'TL', domain_id: 'TL-LEND', kind: 'object store', description: 'A bucket.' })).problems[0]).toMatchObject({
      rule: 'parent', message: 'data store TL-STORE02 sits under its product or one of its domains: give exactly one of product_id and domain_id',
    });
    expect((await refusal(store, ADD_DATA_STORE, { id: 'TL-STORE01', title: 'again', product_id: 'TL', kind: 'database', description: 'Again.' })).problems[0].rule).toBe('primary-key');
    await expect(runCommand(store, CHANGE_DATA_STORE, { id: 'TL-STORE01', product_id: 'TL' })).rejects.toThrow(/change-data-store takes no product_id/);
    await expect(runCommand(store, CHANGE_DATA_STORE, { id: 'TL-STORE01', provided_by: null })).rejects.toThrow(/change-data-store takes no provided_by/);
    await expect(runCommand(store, CHANGE_REPOSITORY, { id: 'TL-LEND-REPO01', stored_in: ['TL-STORE01'] })).rejects.toThrow(/stored_in/);
    expect((await refusal(store, REMOVE_DATA_STORE, { id: 'TL-STORE01' })).problems[0].message).toBe('Data store TL-STORE01 is referenced, so it stays: TL-LEND-REPO01 stored in TL-STORE01; TL-LEND-EN01-TB stored in TL-STORE01; TL-STORE01 provided by TL-INT01');
    expect((await refusal(store, CHANGE_DATA_STORE, { id: 'TL-STORE09', title: 'x' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no data store TL-STORE09' });
    expect(fileOf(store, 'data_store')).toBe(before);
  });

  it('runs `lathe data-store <command>`, the data_store_ tools and POST /api/data-store/<command>', async () => {
    const root = writeData(domainModelBase(AROUND));
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    expect(await runAggregateCommand(['data-store', 'add-data-store', '--id', 'TL-STORE01', '--title', 'DATABASE_URL', '--product_id', 'TL', '--kind', 'database', '--description', 'The database.', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added data_store TL-STORE01');
    expect((await callTool(root, 'data_store_add_data_store', { id: 'TL-STORE02', title: 'sessionStorage', product_id: 'TL', kind: 'browser storage', description: 'The tab.' })).isError).toBeUndefined();
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const post = (route: string, body: unknown) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/data-store/remove-data-store', { id: 'TL-STORE02' })).status).toBe(200);
      expect((await post('/api/data-store/remove-data-store', { id: 'TL-STORE09' })).status).toBe(422);
      expect((await post('/api/data-store/add-data-store', { id: 'TL-STORE03', colour: 'red' })).status).toBe(400);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
