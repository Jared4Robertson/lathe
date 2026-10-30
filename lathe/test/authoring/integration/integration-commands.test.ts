// The Integration aggregate's commands, queries and refusals (LA-AUT-A14), run on a store as the CLI, the MCP tools and
// the HTTP API run them: each command changes one integration through IntegrationRepository and is refused with its
// reason, changing nothing.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_ADAPTER } from '../../../src/authoring/integration/commands/add-adapter.ts';
import { ADD_INTEGRATION_TEST } from '../../../src/authoring/integration/commands/add-integration-test.ts';
import { CHANGE_ADAPTER } from '../../../src/authoring/integration/commands/change-adapter.ts';
import { CHANGE_INTEGRATION } from '../../../src/authoring/integration/commands/change-integration.ts';
import { CHANGE_INTEGRATION_TEST } from '../../../src/authoring/integration/commands/change-integration-test.ts';
import { REMOVE_ADAPTER } from '../../../src/authoring/integration/commands/remove-adapter.ts';
import { REMOVE_INTEGRATION } from '../../../src/authoring/integration/commands/remove-integration.ts';
import { REMOVE_INTEGRATION_TEST } from '../../../src/authoring/integration/commands/remove-integration-test.ts';
import { GET_INTEGRATION, LIST_INTEGRATIONS, NEXT_INTEGRATION_ID } from '../../../src/authoring/integration/queries.ts';
import { ADD_QUESTION } from '../../../src/authoring/product/commands/add-question.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { closeOpenStores } from '../domain-model-base.ts';
import { integrationDataSet } from './data-set.ts';

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

const fileOf = (store: Store, table: string) => readFileSync(path.join(store.dataDir, `${table}.jsonl`), 'utf8');
type Page = ReturnType<typeof GET_INTEGRATION.run>;

describe('LA-AUT-UC27-R50-T01 each Integration command (LA-AUT-A14) changes one integration through IntegrationRepository, and is reached by name from the CLI, the MCP tools and HTTP', () => {
  it('builds the data set with its own Add commands, and reads an integration whole by any record in it', async () => {
    const store = await integrationDataSet();
    const page = runQuery(store, GET_INTEGRATION, { id: 'TL-INT01-AD' }) as Page;
    expect(page.record).toEqual({ id: 'TL-INT01-AD', kind: 'adapter' });
    expect(page.integration).toMatchObject({ id: 'TL-INT01', title: 'Mail', system: "The library's mail service" });
    expect(page.adapter).toEqual({ adapter: { id: 'TL-INT01-AD', title: 'mailer', integration_id: 'TL-INT01', file: 'src/mailer.ts', description: 'Sends one mail through the service.' }, meets: ['TL-STD-CODE-R01'], packages: ['nodemailer'] });
    expect(page.tests.map((t) => [t.test.id, t.test.state, t.startsFrom])).toEqual([['TL-INT01-T01', 'manual', ['TL-LEND-TD01']]]);
    expect((runQuery(store, GET_INTEGRATION, { id: 'TL-INT01-T01' }) as Page).record).toEqual({ id: 'TL-INT01-T01', kind: 'integration_test' });
    expect(() => runQuery(store, GET_INTEGRATION, { id: 'TL' })).toThrow(/TL is a product, not an integration or a record in one/);
    expect(() => runQuery(store, LIST_INTEGRATIONS, { product_id: 'TL-INT01' })).toThrow(/there is no product TL-INT01/);
    expect(runQuery(store, LIST_INTEGRATIONS, { product_id: 'TL' })).toEqual([{ id: 'TL-INT01', title: 'Mail' }, { id: 'TL-INT02', title: 'Payments' }]);
    expect(runQuery(store, NEXT_INTEGRATION_ID, { kind: 'integration', parent: 'TL' })).toBe('TL-INT03');
    expect(runQuery(store, NEXT_INTEGRATION_ID, { kind: 'integration_test', parent: 'TL-INT01' })).toBe('TL-INT01-T02');
    expect(runQuery(store, NEXT_INTEGRATION_ID, { kind: 'adapter', parent: 'TL-INT02' })).toBe('TL-INT02-AD');
    expect(() => runQuery(store, NEXT_INTEGRATION_ID, { kind: 'adapter', parent: 'TL-INT01' })).toThrow(/TL-INT01 already has its adapter, TL-INT01-AD/);
  });

  it('changes each kind, writing only its own tables: a list given replaces its list, null clears an optional column', async () => {
    const store = await integrationDataSet();
    expect((await runCommand(store, CHANGE_INTEGRATION, { id: 'TL-INT01', system: null })).tables).toEqual(['integration']);
    expect((await runCommand(store, CHANGE_ADAPTER, { id: 'TL-INT01-AD', meets: [], packages: [] })).tables).toEqual(['meets', 'package_use']);
    expect((await runCommand(store, CHANGE_INTEGRATION_TEST, { id: 'TL-INT01-T01', state: 'not automated yet', manual_reason: null })).tables).toEqual(['integration_test']);
  });

  it("refuses an input that is not the command's and a second adapter, changing no file", async () => {
    const store = await integrationDataSet();
    await expect(runCommand(store, ADD_INTEGRATION_TEST, { id: 'TL-INT02-T01', title: 'x', integration_id: 'TL-INT02', level: 'integration', state: 'manual' })).rejects.toThrow(new InputError('add-integration-test needs when'));
    await expect(runCommand(store, CHANGE_ADAPTER, { id: 'TL-INT01-AD', integration_id: 'TL-INT02' })).rejects.toThrow(/change-adapter takes no integration_id/);
    const before = fileOf(store, 'adapter');
    expect((await refusal(store, ADD_ADAPTER, { id: 'TL-INT01-AD2', title: 'other', integration_id: 'TL-INT01', description: 'x' })).problems[0]).toMatchObject({ rule: 'one-adapter', message: 'integration TL-INT01 already has its adapter, so TL-INT01-AD2 cannot be a second: an integration has one' });
    expect((await refusal(store, ADD_ADAPTER, { id: 'TL-INT09-AD', title: 'x', integration_id: 'TL-INT09', description: 'x' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no integration TL-INT09' });
    expect(fileOf(store, 'adapter')).toBe(before);
  });

  it('runs `lathe integration <command>`, the integration_ tools and POST /api/integration/<command>', async () => {
    const store = await integrationDataSet();
    const root = path.dirname(store.dataDir);
    await closeOpenStores();
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    expect(await runAggregateCommand(['integration', 'add-adapter', '--id', 'TL-INT02-AD', '--title', 'payer', '--integration_id', 'TL-INT02', '--description', 'Takes one payment.', '--packages', 'stripe', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added adapter TL-INT02-AD');
    expect((await callTool(root, 'integration_change_integration', { id: 'TL-INT02', system: 'Stripe' })).isError).toBeUndefined();
    expect((await callTool(root, 'integration_get_integration', { id: 'TL-INT02' })).content[0].text).toContain('Adapter TL-INT02-AD: payer [uses stripe]');
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/integration/remove-adapter', { id: 'TL-INT02-AD' })).status).toBe(200);
      expect((await post('/api/integration/remove-integration', { id: 'TL-INT09' })).status).toBe(422);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('LA-STD-CODE-R07-T58 an integration, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
  it('removes a test, an adapter with its links and packages, and an integration whole', async () => {
    const store = await integrationDataSet();
    expect((await runCommand(store, REMOVE_INTEGRATION_TEST, { id: 'TL-INT01-T01' })).changes.map((c) => c.table).sort()).toEqual(['integration_test', 'starts_from']);
    expect((await runCommand(store, REMOVE_ADAPTER, { id: 'TL-INT01-AD' })).changes.map((c) => c.table).sort()).toEqual(['adapter', 'meets', 'package_use']);
    const removed = await integrationDataSet();
    expect(new Set((await runCommand(removed, REMOVE_INTEGRATION, { id: 'TL-INT01' })).changes.map((c) => c.table))).toEqual(new Set(['integration', 'adapter', 'meets', 'package_use', 'integration_test', 'starts_from']));
  });

  it('refuses an integration an open question is about, naming the link', async () => {
    const store = await integrationDataSet({ role: [{ product_id: 'TL', name: 'Librarian', description: 'Runs the library.' }] });
    await runCommand(store, ADD_QUESTION, { id: 'TL-Q02', title: 'Which payments service', product_id: 'TL', owner: 'Librarian', description: 'Undecided.', about: ['TL-INT02'] });
    expect((await refusal(store, REMOVE_INTEGRATION, { id: 'TL-INT02' })).problems[0].message).toBe('Integration TL-INT02 is referenced, so it stays: TL-Q02 about TL-INT02');
  });
});
