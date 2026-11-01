// The Tooling aggregate's commands, queries and refusals, run on a store as the CLI, the MCP tools and the HTTP API
// run them: each command changes one tooling record through ToolingRepository, writes only its own tables (its row, its
// package_use rows and the meets links it starts), and is refused with its reason, changing nothing.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_TOOLING } from '../../../src/authoring/tooling/commands/add-tooling.ts';
import { CHANGE_TOOLING } from '../../../src/authoring/tooling/commands/change-tooling.ts';
import { REMOVE_TOOLING } from '../../../src/authoring/tooling/commands/remove-tooling.ts';
import { GET_TOOLING, LIST_TOOLING, NEXT_TOOLING_ID } from '../../../src/authoring/tooling/queries.ts';
import { ADD_QUESTION } from '../../../src/authoring/product/commands/add-question.ts';
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

/** The Tooling test data set (LA-AUT-TD121): the base, then two records added with its own Add command. */
async function toolingDataSet(): Promise<Store> {
  const store = await openStore(writeData(base()), { latheDataDir: null });
  open.push(store);
  await runCommand(store, ADD_TOOLING, { id: 'TL-LEND-TOOL01', title: 'vitest.config.ts', domain_id: 'TL-LEND', file: 'vitest.config.ts', packages: ['vitest'], meets: ['TL-STD-CODE-R01'] });
  await runCommand(store, ADD_TOOLING, { id: 'TL-LEND-TOOL02', title: 'tsconfig.json', domain_id: 'TL-LEND', file: 'tsconfig.json' });
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

describe('LA-AUT-UC30-R01-T51 each Tooling command changes one tooling record through ToolingRepository', () => {
  it('adds a record with its packages and the rules it meets, and changes it, writing only its own tables', async () => {
    const store = await toolingDataSet();
    expect(store.rows('package_use')).toEqual([{ record_id: 'TL-LEND-TOOL01', package: 'vitest' }]);
    const committed = await runCommand(store, CHANGE_TOOLING, { id: 'TL-LEND-TOOL02', file: 'config/tsconfig.json', packages: ['typescript'], meets: ['TL-STD-CODE-R01'] });
    expect(committed.tables).toEqual(['meets', 'package_use', 'tooling']);
    // The other record's packages and links stay as they are.
    expect(runQuery(store, GET_TOOLING, { id: 'TL-LEND-TOOL01' })).toMatchObject({ packages: ['vitest'], meets: ['TL-STD-CODE-R01'] });
    expect(runQuery(store, GET_TOOLING, { id: 'TL-LEND-TOOL02' })).toMatchObject({ packages: ['typescript'], meets: ['TL-STD-CODE-R01'] });
    expect((runQuery(store, LIST_TOOLING, { domain_id: 'TL-LEND' }) as { id: string }[]).map((r) => r.id)).toEqual(['TL-LEND-TOOL01', 'TL-LEND-TOOL02']);
    expect(runQuery(store, NEXT_TOOLING_ID, { domain_id: 'TL-LEND' })).toBe('TL-LEND-TOOL03');
  });

  it('records the technical records a tooling record generates, and replaces the list', async () => {
    const store = await toolingDataSet();
    expect((await runCommand(store, CHANGE_TOOLING, { id: 'TL-LEND-TOOL01', generates: ['TL-LEND-TOOL02'] })).tables).toEqual(['generates']);
    expect(runQuery(store, GET_TOOLING, { id: 'TL-LEND-TOOL01' })).toMatchObject({ generates: ['TL-LEND-TOOL02'] });
    expect(GET_TOOLING.text(runQuery(store, GET_TOOLING, { id: 'TL-LEND-TOOL01' }) as ReturnType<typeof GET_TOOLING.run>)).toContain('generates: TL-LEND-TOOL02');
    expect(store.rows('generates')).toEqual([{ source_id: 'TL-LEND-TOOL01', target_id: 'TL-LEND-TOOL02' }]);
    expect((await runCommand(store, CHANGE_TOOLING, { id: 'TL-LEND-TOOL01', generates: [] })).tables).toEqual(['generates']);
    expect(store.rows('generates')).toEqual([]);
  });

  it('refuses a record under no domain, a taken ID, and a change of its domain, changing no file', async () => {
    const store = await toolingDataSet();
    const before = fileOf(store, 'tooling');
    expect((await refusal(store, ADD_TOOLING, { id: 'TL-X-TOOL01', title: 'vitest.config.ts', domain_id: 'TL-X', file: 'vitest.config.ts' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no domain TL-X' });
    expect((await refusal(store, ADD_TOOLING, { id: 'TL-LEND-TOOL01', title: 'vitest.config.ts', domain_id: 'TL-LEND', file: 'vitest.config.ts' })).problems[0].rule).toBe('primary-key');
    await expect(runCommand(store, CHANGE_TOOLING, { id: 'TL-LEND-TOOL01', domain_id: 'TL-LEND' })).rejects.toThrow(/change-tooling takes no domain_id/);
    expect(fileOf(store, 'tooling')).toBe(before);
  });
});

describe('LA-AUT-UC30-R01-T52 a tooling record goes with its packages and links, refused while referenced', () => {
  it('removes a record whole, and refuses one a question is about, naming the question', async () => {
    const store = await toolingDataSet();
    const removed = await runCommand(store, REMOVE_TOOLING, { id: 'TL-LEND-TOOL01' });
    expect(removed.changes.map((c) => c.table).sort()).toEqual(['meets', 'package_use', 'tooling']);
    await runCommand(store, ADD_QUESTION, { id: 'TL-LEND-Q01', title: 'Is this needed?', domain_id: 'TL-LEND', owner: 'Librarian', description: 'Keep it or drop it.', about: ['TL-LEND-TOOL02'] });
    const refused = await refusal(store, REMOVE_TOOLING, { id: 'TL-LEND-TOOL02' });
    expect(refused.problems[0]).toMatchObject({ rule: 'referenced', message: 'Tooling TL-LEND-TOOL02 is referenced, so it stays: TL-LEND-Q01 about TL-LEND-TOOL02' });
  });
});

describe('LA-AUT-UC30-R01-T53 each Tooling command and query is reached by name from the CLI, the MCP tools and HTTP', () => {
  it('runs lathe tooling, its MCP tools and POST /api/tooling/<command>', async () => {
    const root = writeData(base());
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    expect(await runAggregateCommand(['tooling', 'add-tooling', '--id', 'TL-LEND-TOOL01', '--title', 'knip.json', '--domain_id', 'TL-LEND', '--file', 'knip.json', '--packages', 'knip', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added package_use record_id TL-LEND-TOOL01, package knip');
    expect(await runAggregateCommand(['tooling', 'next-id', '--domain_id', 'TL-LEND', '--root', root], io)).toBe(0);
    expect(out.pop()).toBe('TL-LEND-TOOL02');
    const read = await callTool(root, 'tooling_get_tooling', { id: 'TL-LEND-TOOL01' });
    expect(read.content[0].text).toContain('packages: knip');
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${url}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      const changed = await post('/api/tooling/change-tooling', { id: 'TL-LEND-TOOL01', meets: ['TL-STD-CODE-R01'] });
      expect(changed.status).toBe(200);
      expect(await changed.json()).toMatchObject({ ok: true, tables: ['meets'] });
      expect((await post('/api/tooling/remove-tooling', { id: 'TL-LEND-TOOL09' })).status).toBe(422);
      expect((await post('/api/tooling/add-tooling', { id: 'TL-LEND-TOOL02' })).status).toBe(400);
    } finally {
      await closeStores(root);
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
