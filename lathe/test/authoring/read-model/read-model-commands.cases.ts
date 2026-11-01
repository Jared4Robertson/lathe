// The commands of the read-model aggregate, run on a store as the CLI, the MCP tools and HTTP run them. Its cases are proved by
// LA-PAT-AGGREGATE-COMMANDS-R10-T01, which runs them from lathe/test/authoring/aggregate/aggregate-commands.test.ts.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { expect, it } from 'vitest';
import { ADD_PROJECTION } from '../../../src/authoring/read-model/commands/add-projection.ts';
import { ADD_QUERY_HANDLER } from '../../../src/authoring/read-model/commands/add-query-handler.ts';
import { ADD_READ_MODEL } from '../../../src/authoring/read-model/commands/add-read-model.ts';
import { CHANGE_PROJECTION } from '../../../src/authoring/read-model/commands/change-projection.ts';
import { CHANGE_QUERY } from '../../../src/authoring/read-model/commands/change-query.ts';
import { CHANGE_QUERY_HANDLER } from '../../../src/authoring/read-model/commands/change-query-handler.ts';
import { CHANGE_READ_MODEL } from '../../../src/authoring/read-model/commands/change-read-model.ts';
import { ADD_READER } from '../../../src/authoring/read-model/commands/add-reader.ts';
import { CHANGE_READER } from '../../../src/authoring/read-model/commands/change-reader.ts';
import { GET_READ_MODEL, LIST_READ_MODELS, NEXT_READ_MODEL_ID } from '../../../src/authoring/read-model/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { type Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';
import { domainModelBase } from '../domain-model-base.ts';
import { AROUND, readModelDataSet } from './data-set.ts';

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
type Whole = ReturnType<typeof GET_READ_MODEL.run>;

export function readModelCommandCases(): void {
  it('builds the data set with its own Add commands, and reads a read model whole by any record in it', async () => {
    const store = await readModelDataSet();
    const whole = runQuery(store, GET_READ_MODEL, { id: 'TL-LEND-QRY01-H' }) as Whole;
    expect(whole).toMatchObject({
      record: { id: 'TL-LEND-QRY01-H', kind: 'query_handler' },
      readModel: { id: 'TL-LEND-RM01' }, reads: ['TL-LEND-A1'], calls: ['TL-LEND-DS01'], fedBy: ['TL-LEND-EV01'],
      queries: [{ query: { id: 'TL-LEND-QRY01' }, selectsBy: ['TL-LEND-SP01'], calls: [], handler: { code: { id: 'TL-LEND-QRY01-H' }, meets: ['TL-STD-CODE-R01'] } }],
      projection: { code: { id: 'TL-LEND-RM01-PJ' } },
      reader: { code: { id: 'TL-LEND-RM01-RD' }, packages: [] },
    });
    expect(whole.fields).toEqual([{ read_model_id: 'TL-LEND-RM01', position: 1, name: 'Status', meaning: 'on_loan while the tool has an active loan, else available.', type: 'text', required: true }]);
    expect(GET_READ_MODEL.text(whole)).toContain('Query TL-LEND-QRY01: List the catalog [selects by TL-LEND-SP01]');
    expect(runQuery(store, LIST_READ_MODELS, { domain_id: 'TL-LEND' })).toEqual([{ id: 'TL-LEND-RM01', title: 'Catalog' }]);
    expect(runQuery(store, NEXT_READ_MODEL_ID, { kind: 'read_model', parent: 'TL-LEND' })).toBe('TL-LEND-RM02');
    expect(runQuery(store, NEXT_READ_MODEL_ID, { kind: 'query', parent: 'TL-LEND-RM01' })).toBe('TL-LEND-QRY02');
    expect(() => runQuery(store, NEXT_READ_MODEL_ID, { kind: 'projection', parent: 'TL-LEND-RM01' })).toThrow(/already has its projection, TL-LEND-RM01-PJ/);
    expect(() => runQuery(store, NEXT_READ_MODEL_ID, { kind: 'reader', parent: 'TL-LEND-RM01' })).toThrow(/already has its reader, TL-LEND-RM01-RD/);
    expect(GET_READ_MODEL.text(whole)).toContain('Reader TL-LEND-RM01-RD: CatalogReader');
    expect(() => runQuery(store, NEXT_READ_MODEL_ID, { kind: 'query_handler', parent: 'TL-LEND-RM01' })).toThrow(/a query_handler sits under a query, and TL-LEND-RM01 is a read_model/);
  });

  it('changes each kind, writing only its own tables: a list given replaces its list, null clears an optional column', async () => {
    const store = await readModelDataSet();
    expect((await runCommand(store, CHANGE_READ_MODEL, { id: 'TL-LEND-RM01', calls: [], fed_by: [] })).tables).toEqual(['calls', 'fed_by']);
    expect((await runCommand(store, CHANGE_QUERY, { id: 'TL-LEND-QRY01', selects_by: [], calls: ['TL-LEND-DS01'] })).tables).toEqual(['calls', 'selects_by']);
    expect((await runCommand(store, CHANGE_PROJECTION, { id: 'TL-LEND-RM01-PJ', file: null, packages: ['kysely'] })).tables).toEqual(['package_use', 'projection']);
    expect((await runCommand(store, CHANGE_QUERY_HANDLER, { id: 'TL-LEND-QRY01-H', description: 'Reads the catalog view, in ID order.' })).tables).toEqual(['query_handler']);
    expect((await runCommand(store, CHANGE_READER, { id: 'TL-LEND-RM01-RD', file: null, meets: ['TL-STD-CODE-R01'] })).tables).toEqual(['meets', 'reader']);
  });

  it("refuses a second projection, reader or query handler, an input that is not the command's, and a record that is not there, changing no file", async () => {
    const store = await readModelDataSet();
    const before = fileOf(store, 'projection');
    expect((await refusal(store, ADD_PROJECTION, { id: 'TL-LEND-RM01-PJ2', title: 'again', read_model_id: 'TL-LEND-RM01', description: 'x' })).problems[0]).toMatchObject({ rule: 'read-model-one-each', message: 'read model TL-LEND-RM01 already has its projection, so TL-LEND-RM01-PJ2 cannot be a second: a read model has one' });
    expect((await refusal(store, ADD_QUERY_HANDLER, { id: 'TL-LEND-QRY01-H2', title: 'again', query_id: 'TL-LEND-QRY01', description: 'x' })).problems[0].rule).toBe('read-model-one-each');
    expect((await refusal(store, ADD_READER, { id: 'TL-LEND-RM01-RD2', title: 'again', read_model_id: 'TL-LEND-RM01', description: 'x' })).problems[0]).toMatchObject({ rule: 'read-model-one-each', message: 'read model TL-LEND-RM01 already has its reader, so TL-LEND-RM01-RD2 cannot be a second: a read model has one' });
    await expect(runCommand(store, CHANGE_READ_MODEL, { id: 'TL-LEND-RM01', domain_id: 'TL-CAT' })).rejects.toThrow(/change-read-model takes no domain_id/);
    expect((await refusal(store, ADD_READ_MODEL, { id: 'TL-SHOP-RM01', title: 'Shop', domain_id: 'TL-SHOP', description: 'x' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no domain TL-SHOP' });
    expect((await refusal(store, CHANGE_QUERY, { id: 'TL-LEND-QRY09', title: 'x' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no query TL-LEND-QRY09' });
    expect(fileOf(store, 'projection')).toBe(before);
  });

  it('runs `lathe read-model <command>`, the read_model_ tools and POST /api/read-model/<command>', async () => {
    const root = writeData(domainModelBase(AROUND));
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    expect(await runAggregateCommand(['read-model', 'add-read-model', '--id', 'TL-LEND-RM01', '--title', 'Catalog', '--domain_id', 'TL-LEND', '--description', 'Every tool.', '--reads', 'TL-LEND-A1', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added reads source_id TL-LEND-RM01, target_id TL-LEND-A1');
    expect((await callTool(root, 'read_model_add_query', { id: 'TL-LEND-QRY01', title: 'List the catalog', read_model_id: 'TL-LEND-RM01', description: 'Every tool.' })).isError).toBeUndefined();
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const post = (route: string, body: unknown) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/read-model/remove-query', { id: 'TL-LEND-QRY01' })).status).toBe(200);
      expect((await post('/api/read-model/remove-read-model', { id: 'TL-LEND-RM09' })).status).toBe(422);
      expect((await post('/api/read-model/add-query', { id: 'TL-LEND-QRY02', colour: 'red' })).status).toBe(400);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
