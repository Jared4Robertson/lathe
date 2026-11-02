// The Entry point aggregate's commands, queries and refusals, run on a store as the CLI, the MCP tools and the HTTP API
// run them: each command changes one entry point through EntryPointRepository, writes only its own tables (its row, its
// package_use rows and the meets links it starts), and is refused with its reason, changing nothing.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_ENTRY_POINT } from '../../../src/technical-specification/entry-point/commands/add-entry-point.ts';
import { CHANGE_ENTRY_POINT } from '../../../src/technical-specification/entry-point/commands/change-entry-point.ts';
import { REMOVE_ENTRY_POINT } from '../../../src/technical-specification/entry-point/commands/remove-entry-point.ts';
import { GET_ENTRY_POINT, LIST_ENTRY_POINTS, NEXT_ENTRY_POINT_ID } from '../../../src/technical-specification/entry-point/queries.ts';
import { ADD_QUESTION } from '../../../src/product/product/commands/add-question.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { writeData, type Data } from '../../store/fixture.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

/** What the records need from other aggregates: a product with a role, a domain, and a standard with a rule. */
const base = (): Data => ({
  product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }],
  role: [{ product_id: 'TL', name: 'Librarian', description: 'Lends and repairs tools.' }],
  domain: [{ id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core', description: 'Lending tools.' }],
  standard: [{ id: 'TL-STD-CODE', title: 'Code', product_id: 'TL', type: 'engineering', description: 'How the code is written.' }],
  standard_rule: [{ id: 'TL-STD-CODE-R01', title: 'Node prefix', standard_id: 'TL-STD-CODE', statement: 'Code MUST import node: modules.' }],
});

/** The Entry point test data set (LA-TEC-TD120): the base, then two records added with its own Add command. */
async function entryPointDataSet(): Promise<Store> {
  const store = await openStore(writeData(base()), { latheDataDir: null });
  open.push(store);
  await runCommand(store, ADD_ENTRY_POINT, { id: 'TL-LEND-ENTRY01', title: 'server.ts', domain_id: 'TL-LEND', file: 'src/server.ts', description: 'Opens the database and serves the API.', packages: ['vitest'], meets: ['TL-STD-CODE-R01'] });
  await runCommand(store, ADD_ENTRY_POINT, { id: 'TL-LEND-ENTRY02', title: 'worker.ts', domain_id: 'TL-LEND', file: 'src/worker.ts', description: 'Starts the reminder worker.' });
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

const fileOf = (store: Store, table: string) => readFileSync(path.join(store.dataDir, `${table}.jsonl`), 'utf8');

describe('LA-TEC-UC29-R01-T51 each Entry point command changes one entry point through EntryPointRepository', () => {
  it('adds a record with its packages and the rules it meets, and changes it, writing only its own tables', async () => {
    const store = await entryPointDataSet();
    expect(store.rows('package_use')).toEqual([{ record_id: 'TL-LEND-ENTRY01', package: 'vitest' }]);
    const committed = await runCommand(store, CHANGE_ENTRY_POINT, { id: 'TL-LEND-ENTRY02', file: 'config/tsconfig.json', packages: ['typescript'], meets: ['TL-STD-CODE-R01'] });
    expect(committed.tables).toEqual(['entry_point', 'meets', 'package_use']);
    // The other record's packages and links stay as they are.
    expect(runQuery(store, GET_ENTRY_POINT, { id: 'TL-LEND-ENTRY01' })).toMatchObject({ packages: ['vitest'], meets: ['TL-STD-CODE-R01'] });
    expect(runQuery(store, GET_ENTRY_POINT, { id: 'TL-LEND-ENTRY02' })).toMatchObject({ packages: ['typescript'], meets: ['TL-STD-CODE-R01'] });
    expect((runQuery(store, LIST_ENTRY_POINTS, { domain_id: 'TL-LEND' }) as { id: string }[]).map((r) => r.id)).toEqual(['TL-LEND-ENTRY01', 'TL-LEND-ENTRY02']);
    expect(runQuery(store, NEXT_ENTRY_POINT_ID, { domain_id: 'TL-LEND' })).toBe('TL-LEND-ENTRY03');
  });

  it('refuses a record under no domain, a taken ID, and a change of its domain, changing no file', async () => {
    const store = await entryPointDataSet();
    const before = fileOf(store, 'entry_point');
    expect((await refusal(store, ADD_ENTRY_POINT, { id: 'TL-X-ENTRY01', title: 'server.ts', domain_id: 'TL-X', file: 'src/server.ts', description: 'Opens the database and serves the API.' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no domain TL-X' });
    expect((await refusal(store, ADD_ENTRY_POINT, { id: 'TL-LEND-ENTRY01', title: 'server.ts', domain_id: 'TL-LEND', file: 'src/server.ts', description: 'Opens the database and serves the API.' })).problems[0].rule).toBe('primary-key');
    await expect(runCommand(store, CHANGE_ENTRY_POINT, { id: 'TL-LEND-ENTRY01', domain_id: 'TL-LEND' })).rejects.toThrow(/change-entry-point takes no domain_id/);
    expect(fileOf(store, 'entry_point')).toBe(before);
  });
});

describe('LA-TEC-UC29-R01-T52 an entry point goes with its packages and links, refused while referenced', () => {
  it('removes a record whole, and refuses one a question is about, naming the question', async () => {
    const store = await entryPointDataSet();
    const removed = await runCommand(store, REMOVE_ENTRY_POINT, { id: 'TL-LEND-ENTRY01' });
    expect(removed.changes.map((c) => c.table).sort()).toEqual(['entry_point', 'meets', 'package_use']);
    await runCommand(store, ADD_QUESTION, { id: 'TL-LEND-Q01', title: 'Is this needed?', domain_id: 'TL-LEND', owner: 'Librarian', description: 'Keep it or drop it.', about: ['TL-LEND-ENTRY02'] });
    const refused = await refusal(store, REMOVE_ENTRY_POINT, { id: 'TL-LEND-ENTRY02' });
    expect(refused.problems[0]).toMatchObject({ rule: 'referenced', message: 'Entry point TL-LEND-ENTRY02 is referenced, so it stays: TL-LEND-Q01 about TL-LEND-ENTRY02' });
  });
});

describe('LA-TEC-UC29-R01-T53 each Entry point command and query is reached by name from the CLI, the MCP tools and HTTP', () => {
  it('runs lathe entry-point, its MCP tools and POST /api/entry-point/<command>', async () => {
    const root = writeData(base());
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    expect(await runAggregateCommand(['entry-point', 'add-entry-point', '--id', 'TL-LEND-ENTRY01', '--title', 'main.ts', '--domain_id', 'TL-LEND', '--file', 'src/main.ts', '--description', 'Starts it.', '--packages', 'knip', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added package_use record_id TL-LEND-ENTRY01, package knip');
    expect(await runAggregateCommand(['entry-point', 'next-id', '--domain_id', 'TL-LEND', '--root', root], io)).toBe(0);
    expect(out.pop()).toBe('TL-LEND-ENTRY02');
    const read = await callTool(root, 'entry_point_get_entry_point', { id: 'TL-LEND-ENTRY01' });
    expect(read.content[0].text).toContain('packages: knip');
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${url}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      const changed = await post('/api/entry-point/change-entry-point', { id: 'TL-LEND-ENTRY01', meets: ['TL-STD-CODE-R01'] });
      expect(changed.status).toBe(200);
      expect(await changed.json()).toMatchObject({ ok: true, tables: ['meets'] });
      expect((await post('/api/entry-point/remove-entry-point', { id: 'TL-LEND-ENTRY09' })).status).toBe(422);
      expect((await post('/api/entry-point/add-entry-point', { id: 'TL-LEND-ENTRY02' })).status).toBe(400);
    } finally {
      await closeStores(root);
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
