// The commands of the endpoint aggregate, run on a store as the CLI, the MCP tools and HTTP run them. Its cases are proved by
// LA-PAT-AGGREGATE-COMMANDS-R10-T01, which runs them from lathe/test/domain-modeling/aggregate/aggregate-commands.test.ts.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { expect, it } from 'vitest';
import { ADD_API_REQUIREMENT } from '../../../src/interface-design/endpoint/commands/add-api-requirement.ts';
import { ADD_ENDPOINT } from '../../../src/interface-design/endpoint/commands/add-endpoint.ts';
import { ADD_ENDPOINT_HANDLER } from '../../../src/interface-design/endpoint/commands/add-endpoint-handler.ts';
import { CHANGE_API_REQUIREMENT } from '../../../src/interface-design/endpoint/commands/change-api-requirement.ts';
import { CHANGE_ENDPOINT } from '../../../src/interface-design/endpoint/commands/change-endpoint.ts';
import { CHANGE_ENDPOINT_HANDLER } from '../../../src/interface-design/endpoint/commands/change-endpoint-handler.ts';
import { CHANGE_ENDPOINT_TEST } from '../../../src/interface-design/endpoint/commands/change-endpoint-test.ts';
import { MOVE_ENDPOINT } from '../../../src/interface-design/endpoint/commands/move-endpoint.ts';
import { GET_ENDPOINT, LIST_ENDPOINTS, NEXT_ENDPOINT_ID } from '../../../src/interface-design/endpoint/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { closeOpenStores } from '../../domain-modeling/domain-model-base.ts';
import { endpointDataSet } from './data-set.ts';

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
type Page = ReturnType<typeof GET_ENDPOINT.run>;

export function endpointCommandCases(): void {
  it('builds the data set with its own Add commands, and reads an endpoint whole by any record in it', async () => {
    const store = await endpointDataSet();
    const page = runQuery(store, GET_ENDPOINT, { id: 'TL-LEND-EP01-H' }) as Page;
    expect(page.record).toEqual({ id: 'TL-LEND-EP01-H', kind: 'endpoint_handler' });
    expect(page.endpoint).toMatchObject({ id: 'TL-LEND-EP01', method: 'POST', route: '/loans', command_id: 'TL-LEND-CMD01' });
    expect(page.endpoint.notes).toBeUndefined();
    expect(page.handler).toEqual({ handler: { id: 'TL-LEND-EP01-H', title: 'postLoan', endpoint_id: 'TL-LEND-EP01', file: 'src/api.ts', description: 'Reads the request and runs Lend a tool.' }, meets: ['TL-STD-CODE-R01'], packages: [] });
    expect(page.requirements.map((r) => [r.requirement.id, r.tests.map((t) => [t.test.id, t.startsFrom])])).toEqual([['TL-LEND-EP01-R01', [['TL-LEND-EP01-R01-T01', ['TL-LEND-TD01']]]]]);
    expect((runQuery(store, GET_ENDPOINT, { id: 'TL-LEND-EP01-R01-T01' }) as Page).record).toEqual({ id: 'TL-LEND-EP01-R01-T01', kind: 'endpoint_test' });
    expect(() => runQuery(store, GET_ENDPOINT, { id: 'TL-LEND-CMD01' })).toThrow(/TL-LEND-CMD01 is a command, not an endpoint or a record in one/);
    expect(runQuery(store, LIST_ENDPOINTS, { parent: 'TL-LEND-CMD01' })).toEqual([{ id: 'TL-LEND-EP01', title: 'POST /loans' }]);
    expect(runQuery(store, LIST_ENDPOINTS, { parent: 'TL-LEND-QRY01' })).toEqual([]);
    expect(() => runQuery(store, LIST_ENDPOINTS, { parent: 'TL-LEND-EP01' })).toThrow(/there is no command or query TL-LEND-EP01/);
    expect(runQuery(store, NEXT_ENDPOINT_ID, { kind: 'endpoint', parent: 'TL-LEND-QRY01' })).toBe('TL-LEND-EP02');
    expect(runQuery(store, NEXT_ENDPOINT_ID, { kind: 'api_requirement', parent: 'TL-LEND-EP01' })).toBe('TL-LEND-EP01-R02');
    expect(runQuery(store, NEXT_ENDPOINT_ID, { kind: 'endpoint_test', parent: 'TL-LEND-EP01-R01' })).toBe('TL-LEND-EP01-R01-T02');
    expect(() => runQuery(store, NEXT_ENDPOINT_ID, { kind: 'endpoint_handler', parent: 'TL-LEND-EP01' })).toThrow(/TL-LEND-EP01 already has its endpoint handler, TL-LEND-EP01-H/);
  });

  it('changes each kind, writing only its own tables, and moves an endpoint to a query', async () => {
    const store = await endpointDataSet();
    expect((await runCommand(store, CHANGE_ENDPOINT, { id: 'TL-LEND-EP01', notes: 'Idempotent by request ID.' })).tables).toEqual(['endpoint']);
    expect((await runCommand(store, CHANGE_API_REQUIREMENT, { id: 'TL-LEND-EP01-R01', group_name: 'Errors' })).tables).toEqual(['api_requirement']);
    expect((await runCommand(store, CHANGE_ENDPOINT_HANDLER, { id: 'TL-LEND-EP01-H', file: null, meets: [], packages: ['hono'] })).tables).toEqual(['endpoint_handler', 'meets', 'package_use']);
    expect((await runCommand(store, CHANGE_ENDPOINT_TEST, { id: 'TL-LEND-EP01-R01-T01', starts_from: [] })).tables).toEqual(['starts_from']);
    await runCommand(store, CHANGE_ENDPOINT, { id: 'TL-LEND-EP01', title: 'GET /loans', method: 'GET' });
    expect((await runCommand(store, MOVE_ENDPOINT, { id: 'TL-LEND-EP01', query_id: 'TL-LEND-QRY01' })).tables).toEqual(['endpoint']);
    expect(store.record('TL-LEND-EP01')?.row).toMatchObject({ query_id: 'TL-LEND-QRY01' });
    expect(store.record('TL-LEND-EP01')?.row.command_id).toBeUndefined();
    expect((await refusal(store, MOVE_ENDPOINT, { id: 'TL-LEND-EP01', query_id: 'TL-LEND-QRY01' })).problems[0]).toMatchObject({ rule: 'parent', message: 'TL-LEND-EP01 already exposes TL-LEND-QRY01' });
    expect((await refusal(store, MOVE_ENDPOINT, { id: 'TL-LEND-EP01', command_id: 'TL-LEND-CMD01', query_id: 'TL-LEND-QRY01' })).problems[0].message).toMatch(/give command_id or query_id, not both/);
  });

  it("refuses an input that is not the command's, a second handler, and an endpoint titled otherwise than its method and route, changing no file", async () => {
    const store = await endpointDataSet();
    await expect(runCommand(store, ADD_API_REQUIREMENT, { id: 'TL-LEND-EP01-R02', title: 'x', endpoint_id: 'TL-LEND-EP01' })).rejects.toThrow(new InputError('add-api-requirement needs statement'));
    await expect(runCommand(store, CHANGE_ENDPOINT, { id: 'TL-LEND-EP01', command_id: 'TL-LEND-CMD01' })).rejects.toThrow(/change-endpoint takes no command_id/);
    const before = fileOf(store, 'endpoint_handler');
    expect((await refusal(store, ADD_ENDPOINT_HANDLER, { id: 'TL-LEND-EP01-H2', title: 'other', endpoint_id: 'TL-LEND-EP01', description: 'x' })).problems[0]).toMatchObject({ rule: 'one-endpoint-handler', message: 'endpoint TL-LEND-EP01 already has its endpoint handler, so TL-LEND-EP01-H2 cannot be a second: an endpoint has one' });
    expect(fileOf(store, 'endpoint_handler')).toBe(before);
    expect((await refusal(store, ADD_ENDPOINT, { id: 'TL-LEND-EP02', title: 'GET /x', query_id: 'TL-LEND-QRY01', method: 'GET', route: '/loans', description: 'x' })).problems[0].message).toMatch(/endpoint/);
  });

  it('runs `lathe endpoint <command>`, the endpoint_ tools and POST /api/endpoint/<command>', async () => {
    const store = await endpointDataSet();
    const root = path.dirname(store.dataDir);
    await closeOpenStores();
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    expect(await runAggregateCommand(['endpoint', 'add-endpoint', '--id', 'TL-LEND-EP02', '--title', 'GET /loans', '--query_id', 'TL-LEND-QRY01', '--method', 'GET', '--route', '/loans', '--description', 'The loans.', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added endpoint TL-LEND-EP02');
    expect((await callTool(root, 'endpoint_add_api_requirement', { id: 'TL-LEND-EP02-R01', title: 'Loans newest first', endpoint_id: 'TL-LEND-EP02', statement: 'Loans MUST come newest first.' })).isError).toBeUndefined();
    expect((await callTool(root, 'endpoint_get_endpoint', { id: 'TL-LEND-EP02-R01' })).content[0].text).toContain('API requirement TL-LEND-EP02-R01: Loans newest first');
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/endpoint/move-endpoint', { id: 'TL-LEND-EP02', command_id: 'TL-LEND-CMD01' })).status).toBe(200);
      const refused = await post('/api/endpoint/add-endpoint-handler', { id: 'TL-LEND-EP01-H3', title: 'again', endpoint_id: 'TL-LEND-EP01', description: 'x' });
      expect(refused.status).toBe(422);
      expect(await refused.json()).toMatchObject({ ok: false, problems: [{ rule: 'one-endpoint-handler' }] });
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
