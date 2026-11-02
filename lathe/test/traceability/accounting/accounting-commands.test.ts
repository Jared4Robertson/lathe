// The Slot filling (LA-TRC-A4) and Provision (LA-TRC-A5) aggregates' commands, run on a store as the CLI, the MCP tools
// and the HTTP API run them: each changes one fill or one provision through its own repository, writing only its own
// link table, and a refusal changes nothing.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { FILL_SLOT } from '../../../src/traceability/slot-filling/commands/fill-slot.ts';
import { STOP_FILLING_SLOT } from '../../../src/traceability/slot-filling/commands/stop-filling-slot.ts';
import { NAME_PROVIDER } from '../../../src/traceability/provision/commands/name-provider.ts';
import { REMOVE_PROVIDER } from '../../../src/traceability/provision/commands/remove-provider.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

/**
 * A product with a pattern and its slot, two tooling records (TOOL01 generates TOOL02), a data store, a domain service
 * and the integration that may provide them, written as their rows.
 */
const rows = () => ({
  product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }],
  domain: [{ id: 'TL-LEND', title: 'Lending', product_id: 'TL', position: 1, subdomain_type: 'core', description: 'Lending tools to members and getting them back.' }],
  pattern: [{ id: 'TL-PAT-ACT', title: 'Librarian action', product_id: 'TL', description: 'An action the librarian takes at the desk.' }],
  slot: [{ id: 'TL-PAT-ACT-SL01', title: 'Refusal message', pattern_id: 'TL-PAT-ACT', statement: 'A fill MUST word the refusal for the librarian.' }],
  tooling: [
    { id: 'TL-LEND-TOOL01', title: 'generate.ts', domain_id: 'TL-LEND', file: 'scripts/generate.ts' },
    { id: 'TL-LEND-TOOL02', title: 'routes.generated.ts', domain_id: 'TL-LEND', file: 'src/routes.generated.ts' },
    { id: 'TL-LEND-TOOL03', title: 'refusals.ts', domain_id: 'TL-LEND', file: 'src/refusals.ts' },
  ],
  generates: [{ source_id: 'TL-LEND-TOOL01', target_id: 'TL-LEND-TOOL02' }],
  integration: [
    { id: 'TL-INT01', title: 'Database host', system: 'Managed PostgreSQL', description: "The service that runs the library's database." },
    { id: 'TL-INT02', title: 'Backup host', system: 'Managed backups', description: 'The service that keeps copies.' },
  ],
  data_store: [{ id: 'TL-STORE01', title: 'DATABASE_URL', product_id: 'TL', kind: 'database', description: "The library's database." }],
});

async function storeOf(): Promise<Store> {
  const store = await openStore(writeData(rows()), { latheDataDir: null });
  open.push(store);
  return store;
}

async function refusal(store: Store, definition: AnyCommand, input: unknown): Promise<StoreError> {
  try {
    await runCommand(store, definition, input);
  } catch (error) {
    if (error instanceof StoreError) return error;
    throw error;
  }
  throw new Error(`${definition.name} was not refused`);
}

describe('LA-TRC-UC21-R50-T01 each Slot filling command changes one fill through SlotFillingRepository, and is reached by name from the CLI, the MCP tools and HTTP', () => {
  it('fills a slot with a hand-written record and stops filling it, writing only the fills table', async () => {
    const store = await storeOf();
    expect((await runCommand(store, FILL_SLOT, { record_id: 'TL-LEND-TOOL03', slot_id: 'TL-PAT-ACT-SL01' })).tables).toEqual(['fills']);
    expect(store.rows('fills')).toEqual([{ source_id: 'TL-LEND-TOOL03', target_id: 'TL-PAT-ACT-SL01' }]);
    expect((await runCommand(store, STOP_FILLING_SLOT, { record_id: 'TL-LEND-TOOL03', slot_id: 'TL-PAT-ACT-SL01' })).tables).toEqual(['fills']);
    expect(store.rows('fills')).toEqual([]);
  });

  it('refuses a generated record, a second fill, a record that is no technical record and a fill that is not there, changing nothing', async () => {
    const store = await storeOf();
    expect((await refusal(store, FILL_SLOT, { record_id: 'TL-LEND-TOOL02', slot_id: 'TL-PAT-ACT-SL01' })).problems[0]).toMatchObject({
      rule: 'fill-is-hand-written', message: 'TL-LEND-TOOL01 generates TL-LEND-TOOL02, so it is derived and cannot fill TL-PAT-ACT-SL01: a fill is written by hand',
    });
    await runCommand(store, FILL_SLOT, { record_id: 'TL-LEND-TOOL03', slot_id: 'TL-PAT-ACT-SL01' });
    expect((await refusal(store, FILL_SLOT, { record_id: 'TL-LEND-TOOL03', slot_id: 'TL-PAT-ACT-SL01' })).problems[0]).toMatchObject({ rule: 'exists' });
    expect((await refusal(store, FILL_SLOT, { record_id: 'TL-LEND', slot_id: 'TL-PAT-ACT-SL01' })).problems.length).toBeGreaterThan(0);
    expect((await refusal(store, STOP_FILLING_SLOT, { record_id: 'TL-LEND-TOOL01', slot_id: 'TL-PAT-ACT-SL01' })).problems[0]).toMatchObject({ rule: 'missing', message: 'TL-LEND-TOOL01 does not fill TL-PAT-ACT-SL01' });
    expect(store.rows('fills')).toEqual([{ source_id: 'TL-LEND-TOOL03', target_id: 'TL-PAT-ACT-SL01' }]);
  });

  it('runs `lathe slot-filling fill-slot`, the slot_filling_ tools and POST /api/slot-filling/<command>', async () => {
    const root = writeData(rows());
    const out: string[] = [];
    expect(await runAggregateCommand(['slot-filling', 'fill-slot', '--record_id', 'TL-LEND-TOOL03', '--slot_id', 'TL-PAT-ACT-SL01', '--root', root], { out: (t) => out.push(t), err: (t) => out.push(t) })).toBe(0);
    expect(out.pop()).toContain('Added fills');
    expect((await callTool(root, 'slot_filling_stop_filling_slot', { record_id: 'TL-LEND-TOOL03', slot_id: 'TL-PAT-ACT-SL01' })).isError).toBeUndefined();
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const post = (route: string, body: unknown) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/slot-filling/fill-slot', { record_id: 'TL-LEND-TOOL03', slot_id: 'TL-PAT-ACT-SL01' })).status).toBe(200);
      expect((await post('/api/slot-filling/fill-slot', { record_id: 'TL-LEND-TOOL02', slot_id: 'TL-PAT-ACT-SL01' })).status).toBe(422);
      expect((await post('/api/slot-filling/fill-slot', { record_id: 'TL-LEND-TOOL03', colour: 'red' })).status).toBe(400);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('LA-TRC-UC23-R01-T01 each Provision command changes one record\'s provider through ProvisionRepository, and is reached by name from the CLI, the MCP tools and HTTP', () => {
  it('names a provider, replaces it, and removes it, writing only the provided_by table', async () => {
    const store = await storeOf();
    expect((await runCommand(store, NAME_PROVIDER, { record_id: 'TL-STORE01', provider_id: 'TL-INT01' })).tables).toEqual(['provided_by']);
    await runCommand(store, NAME_PROVIDER, { record_id: 'TL-STORE01', provider_id: 'TL-INT02' });
    expect(store.rows('provided_by')).toEqual([{ source_id: 'TL-STORE01', target_id: 'TL-INT02' }]);
    await runCommand(store, NAME_PROVIDER, { record_id: 'TL-LEND-TOOL03', provider_id: 'TL-INT01' });
    expect((await runCommand(store, REMOVE_PROVIDER, { record_id: 'TL-STORE01' })).tables).toEqual(['provided_by']);
    expect(store.rows('provided_by')).toEqual([{ source_id: 'TL-LEND-TOOL03', target_id: 'TL-INT01' }]);
  });

  it('refuses a record nothing may provide, a provider of another kind and a removal of no provider, changing nothing', async () => {
    const store = await storeOf();
    expect((await refusal(store, NAME_PROVIDER, { record_id: 'TL-LEND', provider_id: 'TL-INT01' })).problems.length).toBeGreaterThan(0);
    expect((await refusal(store, NAME_PROVIDER, { record_id: 'TL-STORE01', provider_id: 'TL-LEND-TOOL01' })).problems[0].rule).toBe('relation-pair');
    expect((await refusal(store, REMOVE_PROVIDER, { record_id: 'TL-STORE01' })).problems[0]).toMatchObject({ rule: 'missing', message: 'nothing provides TL-STORE01' });
    expect(store.rows('provided_by')).toEqual([]);
  });

  it('runs `lathe provision name-provider`, the provision_ tools and POST /api/provision/<command>', async () => {
    const root = writeData(rows());
    const out: string[] = [];
    expect(await runAggregateCommand(['provision', 'name-provider', '--record_id', 'TL-STORE01', '--provider_id', 'TL-INT01', '--root', root], { out: (t) => out.push(t), err: (t) => out.push(t) })).toBe(0);
    expect(out.pop()).toContain('Added provided_by');
    expect((await callTool(root, 'provision_remove_provider', { record_id: 'TL-STORE01' })).isError).toBeUndefined();
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const post = (route: string, body: unknown) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/provision/name-provider', { record_id: 'TL-STORE01', provider_id: 'TL-INT01' })).status).toBe(200);
      expect((await post('/api/provision/remove-provider', { record_id: 'TL-LEND-TOOL01' })).status).toBe(422);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
