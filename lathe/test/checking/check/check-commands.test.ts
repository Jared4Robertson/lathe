// The Check aggregate's commands, queries and refusals (LA-CHK-A1), run on a product beside Lathe's own checks as the
// CLI, the MCP tools and the HTTP API run them: each command changes one check row through CheckRepository, Lathe's
// own checks stay read-only, and a refusal changes nothing.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_CHECK } from '../../../src/checking/check/commands/add-check.ts';
import { CHANGE_CHECK } from '../../../src/checking/check/commands/change-check.ts';
import { REMOVE_CHECK } from '../../../src/checking/check/commands/remove-check.ts';
import { GET_CHECK, LIST_CHECKS } from '../../../src/checking/check/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { SET_LIMITS } from '../../../src/checking/product-setting/commands/set-limits.ts';
import { SET_TECHNOLOGY_WORDS } from '../../../src/checking/product-setting/commands/set-technology-words.ts';
import { GET_LIMITS } from '../../../src/checking/product-setting/queries.ts';
import { closeCheckingStores, productBesideLathesChecks } from '../data-set.ts';
import { productSettingDataSet } from '../product-setting/data-set.ts';
import { checkDataSet } from './data-set.ts';

afterEach(closeCheckingStores);

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

const checkFile = (store: Store) => readFileSync(path.join(store.dataDir, 'check.jsonl'), 'utf8');
type Summaries = ReturnType<typeof LIST_CHECKS.run>;

describe("LA-PAT-AGGREGATE-COMMANDS-R10-T02 each Check command (LA-CHK-A1) changes one check through its repository, keeps Lathe's own read-only, and is reached by name from every interface", () => {
  it("LA-PAT-AGGREGATE-TESTS-R03-T02 builds the data set with its own Add command, reads a check whole, and lists Lathe's checks before the product's", async () => {
    const store = await checkDataSet();
    expect(runQuery(store, GET_CHECK, { name: 'loan-without-due-date' })).toMatchObject({ name: 'loan-without-due-date', product: 'TL', domain: 'LA-CHK', position: 2, severity: 'error', kinds: [] });
    const listed = runQuery(store, LIST_CHECKS, { product_id: 'TL' }) as Summaries;
    expect(listed.slice(-2).map((c) => [c.name, c.product])).toEqual([['tool-without-photo', 'TL'], ['loan-without-due-date', 'TL']]);
    expect(listed.filter((c) => c.product === null).length).toBe(store.rows('check').length - 2);
    expect(() => runQuery(store, GET_CHECK, { name: 'no-such-check' })).toThrow(/there is no check no-such-check/);
  });

  it("changes and removes the product's own check, writing only its check.jsonl", async () => {
    const store = await checkDataSet();
    const changed = await runCommand(store, CHANGE_CHECK, { name: 'tool-without-photo', severity: 'error', kinds: null });
    expect(changed.files).toEqual(['check.jsonl']);
    expect(runQuery(store, GET_CHECK, { name: 'tool-without-photo' })).toMatchObject({ severity: 'error', kinds: [] });
    await runCommand(store, REMOVE_CHECK, { name: 'tool-without-photo' });
    expect(checkFile(store)).not.toContain('tool-without-photo');
  });

  it("LA-PAT-AGGREGATE-COMMANDS-R02-T02 LA-PAT-CLI-STEPS-R02-T02 LA-PAT-MCP-STEPS-R02-T02 refuses a check named like one of Lathe's (LA-CHK-INV01) and any change or removal of Lathe's own (LA-CHK-INV02), naming lathe/data/check.jsonl and changing nothing", async () => {
    const store = await checkDataSet();
    const before = checkFile(store);
    const query = 'SELECT NULL AS record, NULL AS message WHERE false';
    const added = await refusal(store, ADD_CHECK, { name: 'view-unused', product_id: 'TL', domain_id: 'LA-CHK', position: 3, severity: 'warning', summary: 'x.', explanation: 'x.', query });
    expect(added.problems[0]).toMatchObject({ rule: 'check-name-own', message: "check view-unused already exists as one of Lathe's own (lathe/data/check.jsonl); give the check a name of its own" });
    expect((await refusal(store, ADD_CHECK, { name: 'tool-without-photo', product_id: 'TL', domain_id: 'LA-CHK', position: 3, severity: 'warning', summary: 'x.', explanation: 'x.', query })).problems[0].message).toBe('check tool-without-photo already exists');
    expect((await refusal(store, CHANGE_CHECK, { name: 'view-unused', severity: 'warning' })).problems[0]).toMatchObject({ rule: 'check-read-only', message: "check view-unused is Lathe's own (lathe/data/check.jsonl), so it cannot change or be removed" });
    expect((await refusal(store, REMOVE_CHECK, { name: 'view-unused' })).problems[0].rule).toBe('check-read-only');
    await expect(runCommand(store, CHANGE_CHECK, { name: 'tool-without-photo', product_id: 'TL' })).rejects.toThrow(InputError);
    expect(checkFile(store)).toBe(before);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R01-T02 LA-PAT-CLI-STEPS-R01-T02 runs `lathe check <command>`, the check_ tools and POST /api/check/<command>', async () => {
    const store = await checkDataSet();
    const root = path.dirname(store.dataDir);
    await closeCheckingStores();
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    expect(await runAggregateCommand(['check', 'change-check', '--name', 'tool-without-photo', '--position', '3', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Changed check tool-without-photo');
    expect((await callTool(root, 'check_get_check', { name: 'tool-without-photo' })).content[0].text).toContain('Check tool-without-photo (product TL, warning, position 3)');
    expect((await callTool(root, 'check_remove_check', { name: 'view-unused' })).isError).toBe(true);
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/check/remove-check', { name: 'loan-without-due-date' })).status).toBe(200);
      expect((await post('/api/check/change-check', { name: 'view-unused', severity: 'warning' })).status).toBe(422);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("LA-STD-CODE-R07-T55 a product's check is removed whole, and Lathe's own are never removed", () => {
  it('removes the check row and nothing else', async () => {
    const store = await checkDataSet();
    const removed = await runCommand(store, REMOVE_CHECK, { name: 'loan-without-due-date' });
    expect(removed.changes.map((c) => [c.table, c.key, c.after])).toEqual([['check', 'loan-without-due-date', null]]);
    expect((await refusal(store, REMOVE_CHECK, { name: 'loan-without-due-date' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no check loan-without-due-date' });
  });
});

describe("LA-PAT-AGGREGATE-COMMANDS-R10-T02 Set the product's limits (LA-CHK-A2) writes the product's one settings through its repository, and is reached by name from every interface", () => {
  it('reads the defaults until the limits are set, then the product\'s own, kept in one row', async () => {
    const fresh = await productBesideLathesChecks();
    expect(runQuery(fresh, GET_LIMITS, { product_id: 'TL' })).toEqual({ product: 'TL', maxChildren: 15, maxEntitiesPerAggregate: 7, technologyWords: [], own: false });
    const store = await productSettingDataSet();
    expect(runQuery(store, GET_LIMITS, { product_id: 'TL' })).toEqual({ product: 'TL', maxChildren: 20, maxEntitiesPerAggregate: 9, technologyWords: [], own: true });
    const again = await runCommand(store, SET_LIMITS, { product_id: 'TL', max_children: 12, max_entities_per_aggregate: 9 });
    expect(again.changes.map((c) => c.table)).toEqual(['product_setting']);
    expect(store.rows('product_setting')).toEqual([{ product_id: 'TL', max_children: 12, max_entities_per_aggregate: 9, technology_words: [] }]);
    expect(() => runQuery(store, GET_LIMITS, { product_id: 'XX' })).toThrow(/there is no product XX/);
  });

  it('sets the technology words, keeping the limits, and keeps the words when the limits are set', async () => {
    const fresh = await productBesideLathesChecks();
    expect((await runCommand(fresh, SET_TECHNOLOGY_WORDS, { product_id: 'TL', technology_words: ['React', ' Postgres ', 'React'] })).tables).toEqual(['product_setting']);
    expect(fresh.rows('product_setting')).toEqual([{ product_id: 'TL', max_children: 15, max_entities_per_aggregate: 7, technology_words: ['Postgres', 'React'] }]);
    await runCommand(fresh, SET_LIMITS, { product_id: 'TL', max_children: 12, max_entities_per_aggregate: 9 });
    expect(runQuery(fresh, GET_LIMITS, { product_id: 'TL' })).toEqual({ product: 'TL', maxChildren: 12, maxEntitiesPerAggregate: 9, technologyWords: ['Postgres', 'React'], own: true });
    await expect(runCommand(fresh, SET_TECHNOLOGY_WORDS, { product_id: 'TL' })).rejects.toThrow(new InputError('set-technology-words needs technology_words'));
  });

  it('refuses a limit below 1 and a limit left out, changing nothing', async () => {
    const store = await productSettingDataSet();
    await expect(runCommand(store, SET_LIMITS, { product_id: 'TL', max_children: 0, max_entities_per_aggregate: 9 })).rejects.toThrow();
    await expect(runCommand(store, SET_LIMITS, { product_id: 'TL', max_children: 10 })).rejects.toThrow(new InputError('set-limits needs max_entities_per_aggregate'));
    expect(store.rows('product_setting')).toEqual([{ product_id: 'TL', max_children: 20, max_entities_per_aggregate: 9, technology_words: [] }]);
  });

  it('runs `lathe product-setting set-limits`, the product_setting_ tools and POST /api/product-setting/set-limits', async () => {
    const store = await productSettingDataSet();
    const root = path.dirname(store.dataDir);
    await closeCheckingStores();
    const out: string[] = [];
    expect(await runAggregateCommand(['product-setting', 'set-limits', '--product_id', 'TL', '--max_children', '30', '--max_entities_per_aggregate', '8', '--root', root], { out: (t) => out.push(t), err: (t) => out.push(t) })).toBe(0);
    expect((await callTool(root, 'product_setting_get_limits', { product_id: 'TL' })).content[0].text).toBe('Limits of TL\n  max_children: 30\n  max_entities_per_aggregate: 8\n  technology_words: none');
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const posted = await fetch(`${base}/api/product-setting/set-limits`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product_id: 'TL', max_children: 15, max_entities_per_aggregate: 7 }) });
      expect(posted.status).toBe(200);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
