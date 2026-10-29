// The Domain aggregate's commands, queries and refusals (LA-AUT-A4), run on a store as the CLI, the MCP tools and the
// HTTP API run them: each command changes one domain through DomainRepository, holds it to its rules before it saves,
// and is refused with its reason, changing nothing.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_REPOSITORY } from '../../../src/authoring/domain/commands/add-repository.ts';
import { CHANGE_CAPABILITY } from '../../../src/authoring/domain/commands/change-capability.ts';
import { CHANGE_DOMAIN } from '../../../src/authoring/domain/commands/change-domain.ts';
import { CHANGE_REPOSITORY } from '../../../src/authoring/domain/commands/change-repository.ts';
import { CHANGE_SERVICE } from '../../../src/authoring/domain/commands/change-service.ts';
import { REMOVE_CAPABILITY } from '../../../src/authoring/domain/commands/remove-capability.ts';
import { REMOVE_DOMAIN } from '../../../src/authoring/domain/commands/remove-domain.ts';
import { REMOVE_DOMAIN_SERVICE } from '../../../src/authoring/domain/commands/remove-domain-service.ts';
import { GET_DOMAIN, LIST_DOMAINS, NEXT_DOMAIN_ID } from '../../../src/authoring/domain/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { everyKind } from '../../store/fixture.ts';
import { writeData } from '../../helpers.ts';
import { lendingDomain } from './data-set.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

/** A store on the data set, or on every kind's data when a test needs another aggregate's records. */
async function storeOf(data?: ReturnType<typeof everyKind>): Promise<Store> {
  const store = data ? await openStore(writeData(data), { latheDataDir: null }) : await lendingDomain();
  open.push(store);
  return store;
}

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

describe('LA-AUT-UC02-R06-T02 each Domain command (LA-AUT-A4) changes one domain through DomainRepository, held to its rules', () => {
  it('builds a domain with its own commands, and reads it whole by any record in it', async () => {
    const store = await storeOf();
    const whole = runQuery(store, GET_DOMAIN, { id: 'TL-LEND-DS01-T01' }) as ReturnType<typeof GET_DOMAIN.run>;
    expect(whole.record).toEqual({ id: 'TL-LEND-DS01-T01', kind: 'domain_service_test' });
    expect(whole.domain.id).toBe('TL-LEND');
    expect(whole.capabilities.map((c) => c.capability.id)).toEqual(['TL-LEND-CAP01']);
    expect(whole.domainServices.map((s) => s.service)).toEqual([{ service: { id: 'TL-LEND-DS01-SV', title: 'lateFee', domain_service_id: 'TL-LEND-DS01', file: 'src/fees.ts' }, meets: [], packages: [] }]);
    expect(whole.domainServices[0].tests.map((t) => t.test.id)).toEqual(['TL-LEND-DS01-T01']);
    expect(whole.repositories).toEqual([expect.objectContaining({ persists: null, alsoPersists: [], meets: [], packages: [] })]);
    expect(runQuery(store, LIST_DOMAINS, { product_id: 'TL' })).toEqual([{ id: 'TL-LEND', title: 'Lending' }]);
    expect(runQuery(store, NEXT_DOMAIN_ID, { kind: 'capability', parent: 'TL-LEND' })).toBe('TL-LEND-CAP02');
    expect(runQuery(store, NEXT_DOMAIN_ID, { kind: 'domain_service_test', parent: 'TL-LEND-DS01' })).toBe('TL-LEND-DS01-T02');
    expect(() => runQuery(store, NEXT_DOMAIN_ID, { kind: 'service', parent: 'TL-LEND-DS01' })).toThrow(/already has its service, TL-LEND-DS01-SV/);
    expect(() => runQuery(store, NEXT_DOMAIN_ID, { kind: 'domain', parent: 'TL' })).toThrow(/has no next ID/);
  });

  it('changes a domain and a capability\'s links, writing only its own tables; null clears an optional column', async () => {
    const store = await storeOf(everyKind());
    expect((await runCommand(store, CHANGE_CAPABILITY, { id: 'TL-LEND-CAP01', serves: [] })).tables).toEqual(['serves']);
    await runCommand(store, CHANGE_DOMAIN, { id: 'TL-LEND', notes: 'Fines are kept low.' });
    expect((await runCommand(store, CHANGE_DOMAIN, { id: 'TL-LEND', notes: null })).tables).toEqual(['domain']);
    expect(store.record('TL-LEND')?.row).not.toHaveProperty('notes');
    const changed = await runCommand(store, CHANGE_SERVICE, { id: 'TL-LEND-DS01-SV', meets: ['TL-STD-CODE-R01'], packages: ['date-fns'] });
    expect(changed.tables).toEqual(['meets', 'package_use']);
  });

  it('refuses a repository share naming an aggregate a repository persists (repository-share-unpersisted), and changes no file', async () => {
    // TL-LEND-REPO01 persists TL-LEND-A1 and records a share of TL-LEND-A2.
    const store = await storeOf(everyKind());
    const before = fileOf(store, 'persists');
    expect((await refusal(store, CHANGE_REPOSITORY, { id: 'TL-LEND-REPO01', persists: 'TL-LEND-A2' })).problems).toEqual([
      expect.objectContaining({ rule: 'repository-share-unpersisted', message: 'TL-LEND-REPO01 cannot also record TL-LEND-A2, the aggregate it persists' }),
    ]);
    const second = { id: 'TL-LEND-REPO02', title: 'ToolRepository', domain_id: 'TL-LEND', file: 'src/lending/tools.ts', description: 'Keeps tools.', persists: 'TL-LEND-A2' };
    expect((await refusal(store, ADD_REPOSITORY, second)).problems).toEqual([
      expect.objectContaining({ rule: 'repository-share-unpersisted', message: 'TL-LEND-REPO01 cannot also record TL-LEND-A2, which TL-LEND-REPO02 persists: an aggregate has one repository' }),
    ]);
    expect(fileOf(store, 'persists')).toBe(before);
  });

  it('removes a domain service with its service and tests, and refuses a record while another aggregate references it', async () => {
    const own = await storeOf();
    const removed = await runCommand(own, REMOVE_DOMAIN_SERVICE, { id: 'TL-LEND-DS01' });
    expect(removed.changes.filter((c) => c.after === null).map((c) => `${c.table} ${c.key}`).sort()).toEqual(['domain_service TL-LEND-DS01', 'domain_service_test TL-LEND-DS01-T01', 'service TL-LEND-DS01-SV']);
    await runCommand(own, REMOVE_DOMAIN, { id: 'TL-LEND' });
    expect(own.rows('domain')).toEqual([]);
    const store = await storeOf(everyKind());
    expect((await refusal(store, REMOVE_CAPABILITY, { id: 'TL-LEND-CAP01' })).problems[0].message).toMatch(/^Capability TL-LEND-CAP01 is referenced, so it stays: .*TL-LEND-UC01/);
    expect((await refusal(store, REMOVE_DOMAIN, { id: 'TL-LEND' })).problems[0].rule).toBe('referenced');
  });

  it('refuses an input that is not the command\'s', async () => {
    const store = await storeOf();
    await expect(runCommand(store, CHANGE_DOMAIN, { id: 'TL-LEND', product_id: 'TL' })).rejects.toThrow(/change-domain takes no product_id/);
    await expect(runCommand(store, CHANGE_DOMAIN, { id: 'TL-LEND', subdomain_type: 'central' })).rejects.toThrow(InputError);
    expect((await refusal(store, CHANGE_DOMAIN, { id: 'TL-SHOP', title: 'Shop' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no domain TL-SHOP' });
  });

  it('runs `lathe domain <command>`, the domain_ tools and POST /api/domain/<command> by name', async () => {
    const root = writeData(everyKind());
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t), stdin: async () => '' };
    expect(await runAggregateCommand(['domain', 'add-term', '--id', 'TL-LEND-TM02', '--title', 'Member', '--domain_id', 'TL-LEND', '--meaning', 'Someone who borrows tools.', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added term TL-LEND-TM02');
    expect((await callTool(root, 'domain_change_term', { id: 'TL-LEND-TM02', group_name: 'People' })).isError).toBeUndefined();
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const post = (route: string, body: unknown) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      expect((await post('/api/domain/remove-term', { id: 'TL-LEND-TM02' })).status).toBe(200);
      expect((await post('/api/domain/remove-capability', { id: 'TL-LEND-CAP01' })).status).toBe(422);
    } finally {
      await closeStores(root);
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
