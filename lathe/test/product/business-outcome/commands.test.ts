// The Business outcome aggregate's commands, queries and refusals (LA-PRD-A16), run on a store as the CLI, the MCP
// tools and the HTTP API run them: each command changes one outcome through BusinessOutcomeRepository, writes only its
// own tables, and is refused with its reason, changing nothing.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_BUSINESS_OUTCOME } from '../../../src/product/business-outcome/commands/add-business-outcome.ts';
import { CHANGE_BUSINESS_OUTCOME } from '../../../src/product/business-outcome/commands/change-business-outcome.ts';
import { REMOVE_BUSINESS_OUTCOME } from '../../../src/product/business-outcome/commands/remove-business-outcome.ts';
import { GET_BUSINESS_OUTCOME, LIST_BUSINESS_OUTCOMES, NEXT_BUSINESS_OUTCOME_ID } from '../../../src/product/business-outcome/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { writeData, type Data } from '../../store/fixture.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

/** What the outcomes need from other aggregates: a product, a domain whose capability will serve one, and a test. */
const base = (): Data => ({
  product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }],
  domain: [{ id: 'TL-LEND', title: 'Lending', product_id: 'TL', position: 1, subdomain_type: 'core', description: 'Lending tools.' }],
  capability: [{ id: 'TL-LEND-CAP01', title: 'Lending', domain_id: 'TL-LEND', position: 1, description: 'Lending tools and taking them back.' }],
  domain_service: [{ id: 'TL-LEND-DS01', title: 'Late fee', domain_id: 'TL-LEND', statement: 'The fee MUST be a day rate times the days late.' }],
  domain_service_test: [{ id: 'TL-LEND-DS01-T01', title: 'Fee for three days', domain_service_id: 'TL-LEND-DS01', level: 'unit', state: 'automated', file: 'test/fee.test.ts', when: 'Three days late.', then: 'Three day rates.' }],
});

/** The Business outcome test data set (LA-PRD-TD116): the base, then two outcomes added with Add a business outcome. */
async function businessOutcomeDataSet(data: Data = base()): Promise<Store> {
  const store = await openStore(writeData(data), { latheDataDir: null });
  open.push(store);
  await runCommand(store, ADD_BUSINESS_OUTCOME, { id: 'TL-BO01', title: 'More tools in use', product_id: 'TL', statement: 'Members borrow more of the tools the library holds.', measure: 'Loans opened per tool per month.', target: 'Two loans per tool per month within a year.', measured_by: ['TL-LEND-DS01-T01'] });
  await runCommand(store, ADD_BUSINESS_OUTCOME, { id: 'TL-BO02', title: 'Fewer late returns', product_id: 'TL', statement: 'Fewer tools come back late.', measure: 'Late returns per month.', target: 'Under five a month.', measured_outside: 'The librarian counts late slips each month.' });
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

describe('LA-PRD-UC22-R01-T51 each Business outcome command changes one outcome through BusinessOutcomeRepository', () => {
  it('adds an outcome with what measures it, writing only its own tables, and changes it', async () => {
    const store = await businessOutcomeDataSet();
    expect(store.rows('measured_by')).toEqual([{ source_id: 'TL-BO01', target_id: 'TL-LEND-DS01-T01' }]);
    const committed = await runCommand(store, CHANGE_BUSINESS_OUTCOME, { id: 'TL-BO02', notes: 'From the desk log.', measured_outside: null, measured_by: ['TL-LEND-DS01-T01'] });
    expect(committed.tables).toEqual(['business_outcome', 'measured_by']);
    expect(runQuery(store, GET_BUSINESS_OUTCOME, { id: 'TL-BO02' })).toMatchObject({ outcome: { id: 'TL-BO02', notes: 'From the desk log.' }, measuredBy: ['TL-LEND-DS01-T01'], servedBy: [] });
    expect(store.record('TL-BO02')?.row.measured_outside).toBeUndefined();
    expect(runQuery(store, LIST_BUSINESS_OUTCOMES, { product_id: 'TL' })).toEqual([
      { id: 'TL-BO01', title: 'More tools in use' },
      { id: 'TL-BO02', title: 'Fewer late returns' },
    ]);
    expect(runQuery(store, NEXT_BUSINESS_OUTCOME_ID, { product_id: 'TL' })).toBe('TL-BO03');
  });

  it('refuses an outcome of no product, a taken ID, and an input that is not the command\'s, changing no file', async () => {
    const store = await businessOutcomeDataSet();
    const before = fileOf(store, 'business_outcome');
    const outcome = { title: 'X', statement: 'X.', measure: 'X.', target: 'X.' };
    expect((await refusal(store, ADD_BUSINESS_OUTCOME, { id: 'TL-BO03', product_id: 'XX', ...outcome })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no product XX' });
    expect((await refusal(store, ADD_BUSINESS_OUTCOME, { id: 'TL-BO01', product_id: 'TL', ...outcome })).problems[0]).toMatchObject({ rule: 'primary-key', message: 'business outcome TL-BO01 already exists' });
    await expect(runCommand(store, CHANGE_BUSINESS_OUTCOME, { id: 'TL-BO01', product_id: 'TL' })).rejects.toThrow(/change-business-outcome takes no product_id/);
    await expect(runCommand(store, CHANGE_BUSINESS_OUTCOME, { id: 'TL-BO01', statement: null })).rejects.toThrow(InputError);
    expect(fileOf(store, 'business_outcome')).toBe(before);
  });
});

describe('LA-PRD-UC22-R01-T52 a business outcome goes with its measured_by links, refused while a capability serves it', () => {
  it('removes an outcome with its links, and refuses one a capability serves, naming it', async () => {
    const data = base();
    const store = await businessOutcomeDataSet(data);
    const removed = await runCommand(store, REMOVE_BUSINESS_OUTCOME, { id: 'TL-BO01' });
    expect(removed.changes.map((c) => `${c.table} ${c.key}`).sort()).toEqual(['business_outcome TL-BO01', 'measured_by source_id TL-BO01, target_id TL-LEND-DS01-T01']);
    // A capability serving TL-BO02 is A4's link, written as data.
    const served = await openStore(writeData({ ...data, business_outcome: [store.record('TL-BO02')!.row], serves: [{ source_id: 'TL-LEND-CAP01', target_id: 'TL-BO02' }] }), { latheDataDir: null });
    open.push(served);
    const refused = await refusal(served, REMOVE_BUSINESS_OUTCOME, { id: 'TL-BO02' });
    expect(refused.problems[0]).toMatchObject({ rule: 'referenced', message: 'Business outcome TL-BO02 is referenced, so it stays: TL-LEND-CAP01 serves TL-BO02' });
  });
});

describe('LA-PRD-UC22-R01-T53 each Business outcome command and query is reached by name from the CLI, the MCP tools and HTTP', () => {
  it('runs lathe business-outcome, its MCP tools and POST /api/business-outcome/<command>', async () => {
    const root = writeData(base());
    const out: string[] = [];
    const err: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => err.push(t) };
    expect(await runAggregateCommand(['business-outcome', 'add-business-outcome', '--id', 'TL-BO01', '--title', 'More tools in use', '--product_id', 'TL', '--statement', 'More loans.', '--measure', 'Loans a month.', '--target', 'Two a tool.', '--measured_by', 'TL-LEND-DS01-T01', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added measured_by source_id TL-BO01, target_id TL-LEND-DS01-T01');
    expect(await runAggregateCommand(['business-outcome', 'next-id', '--product_id', 'TL', '--root', root], io)).toBe(0);
    expect(out.pop()).toBe('TL-BO02');
    const read = await callTool(root, 'business_outcome_get_business_outcome', { id: 'TL-BO01' });
    expect(read.content[0].text).toContain('measured by: TL-LEND-DS01-T01');
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const changed = await fetch(`${url}/api/business-outcome/change-business-outcome`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'TL-BO01', target: 'Three a tool.' }) });
      expect(changed.status).toBe(200);
      expect(await changed.json()).toMatchObject({ ok: true, tables: ['business_outcome'] });
      const missing = await fetch(`${url}/api/business-outcome/remove-business-outcome`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'TL-BO09' }) });
      expect(missing.status).toBe(422);
    } finally {
      await closeStores(root);
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
