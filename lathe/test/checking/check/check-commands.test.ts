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
import { introducedProblems, introducedText } from '../../../src/cli/operations.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { SET_LIMITS } from '../../../src/checking/product-setting/commands/set-limits.ts';
import { SET_STRICT_CHECK } from '../../../src/checking/product-setting/commands/set-strict-check.ts';
import { strictnessOfProducts, strictProblems, strictSummary } from '../../../src/checking/product-setting/strictness.ts';
import { SET_TECHNOLOGY_WORDS } from '../../../src/checking/product-setting/commands/set-technology-words.ts';
import type { CheckRun } from '../../../src/platform/data/rules.ts';
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

describe("LA-PAT-AGGREGATE-COMMANDS-R13-T02 a product's check is removed whole, and Lathe's own are never removed", () => {
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
    expect(runQuery(fresh, GET_LIMITS, { product_id: 'TL' })).toEqual({ product: 'TL', maxChildren: 15, maxEntitiesPerAggregate: 7, technologyWords: [], strictCheck: false, acceptedWarnings: 0, own: false });
    const store = await productSettingDataSet();
    expect(runQuery(store, GET_LIMITS, { product_id: 'TL' })).toEqual({ product: 'TL', maxChildren: 20, maxEntitiesPerAggregate: 9, technologyWords: [], strictCheck: false, acceptedWarnings: 0, own: true });
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
    expect(runQuery(fresh, GET_LIMITS, { product_id: 'TL' })).toEqual({ product: 'TL', maxChildren: 12, maxEntitiesPerAggregate: 9, technologyWords: ['Postgres', 'React'], strictCheck: false, acceptedWarnings: 0, own: true });
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
    expect((await callTool(root, 'product_setting_get_limits', { product_id: 'TL' })).content[0].text).toBe('Limits of TL\n  max_children: 30\n  max_entities_per_aggregate: 8\n  technology_words: none\n  strict_check: not strict');
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

/** A checks' run holding the given number of warnings about product TL. */
const runWith = (warnings: number): CheckRun => ({
  problems: Array.from({ length: warnings }, (_, i) => ({ severity: 'warning' as const, check: 'lone-child', record: 'TL', message: `Warning ${i}.` })),
  coverage: [],
  chains: [],
});

describe("LA-PAT-AGGREGATE-COMMANDS-R10-T02 Make the product's check strict (LA-CHK-CMD06) writes the product's one settings through its repository, reading the warnings it has now", () => {
  it('LA-CHK-UC01-R11-T02 sets strictness with an accepted count no higher than the warnings now, keeping the limits, and refuses a higher count or a count without strictness', async () => {
    const store = await productSettingDataSet();
    await runCommand(store, SET_STRICT_CHECK, { product_id: 'TL', strict_check: true, accepted_warnings: 2 }, runWith(2));
    expect(store.rows('product_setting')).toEqual([{ product_id: 'TL', max_children: 20, max_entities_per_aggregate: 9, technology_words: [], strict_check: true, accepted_warnings: 2 }]);
    expect(runQuery(store, GET_LIMITS, { product_id: 'TL' })).toMatchObject({ strictCheck: true, acceptedWarnings: 2, maxChildren: 20 });
    // The limits and words keep the strictness.
    await runCommand(store, SET_LIMITS, { product_id: 'TL', max_children: 12, max_entities_per_aggregate: 9 });
    expect(store.rows('product_setting')[0]).toMatchObject({ max_children: 12, strict_check: true, accepted_warnings: 2 });

    await expect(runCommand(store, SET_STRICT_CHECK, { product_id: 'TL', strict_check: true, accepted_warnings: 3 }, runWith(2))).rejects.toThrow(/TL has 2 warnings now, so its strict check cannot accept 3/);
    await expect(runCommand(store, SET_STRICT_CHECK, { product_id: 'TL', strict_check: false, accepted_warnings: 1 }, runWith(2))).rejects.toThrow(/only a strict check accepts warnings/);
    await expect(runCommand(store, SET_STRICT_CHECK, { product_id: 'TL', strict_check: true }, undefined)).rejects.toThrow(/reads the checks' run, and it was given none/);
    expect(store.rows('product_setting')[0]).toMatchObject({ strict_check: true, accepted_warnings: 2 });

    // Accepting none is plain strict, and not strict drops both.
    await runCommand(store, SET_STRICT_CHECK, { product_id: 'TL', strict_check: true, accepted_warnings: 0 }, runWith(2));
    expect(store.rows('product_setting')[0]).toEqual({ product_id: 'TL', max_children: 12, max_entities_per_aggregate: 9, technology_words: [], strict_check: true });
    await runCommand(store, SET_STRICT_CHECK, { product_id: 'TL', strict_check: false }, runWith(2));
    expect(store.rows('product_setting')[0]).toEqual({ product_id: 'TL', max_children: 12, max_entities_per_aggregate: 9, technology_words: [] });
  });

  it('LA-CHK-UC08-R06-T01 `lathe product-setting set-strict-check` runs the checks first, and its answer lists the problems the write introduced', async () => {
    const store = await productBesideLathesChecks();
    const root = path.dirname(store.dataDir);
    await closeCheckingStores();
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    // TL alone has no warning, so its check can accept none.
    expect(await runAggregateCommand(['product-setting', 'set-strict-check', '--product_id', 'TL', '--strict_check', 'true', '--accepted_warnings', '1', '--root', root], io)).toBe(1);
    expect(out.join('\n')).toContain('TL has 0 warnings now, so its strict check cannot accept 1');
    out.length = 0;
    expect(await runAggregateCommand(['product-setting', 'set-strict-check', '--product_id', 'TL', '--strict_check', 'true', '--root', root], io)).toBe(0);
    expect(out.join('\n')).toContain('No new warnings.');
    const tool = await callTool(root, 'product_setting_set_strict_check', { product_id: 'TL', strict_check: false });
    expect(tool.structuredContent).toMatchObject({ introduced: [] });
  });
});

describe('the problems a write introduced', () => {
  const warning = (check: string, record: string | null, message: string) => ({ severity: 'warning' as const, check, record, message });

  it('LA-CHK-UC08-R06-T02 are the warnings, strict-check and strict-gaps errors after it that were not before, a warning whose words changed with the data being the same one', () => {
    const before = [warning('pattern-candidate', 'TL-PAT-SL01', 'Slot has 3 fills.'), warning('not-proved', 'TL-UC01-R01', 'Not proved.')];
    const after = [
      warning('pattern-candidate', 'TL-PAT-SL01', 'Slot has 4 fills.'),
      warning('not-proved', 'TL-UC01-R01', 'Not proved.'),
      warning('not-proved', 'TL-UC01-R02', 'Not proved.'),
      { severity: 'error' as const, check: 'strict-check', record: 'TL', message: 'Fails.' },
      { severity: 'error' as const, check: 'strict-gaps', record: 'TL', message: 'Has 1 gap.' },
      { severity: 'error' as const, check: 'missing-parent', record: 'TL-X', message: 'An error.' },
    ];
    expect(introducedProblems(before, after)).toEqual([after[2], after[3], after[4]]);
    // A strict product that had gaps before has the same strict-gaps error after, whatever its count says.
    expect(introducedProblems([{ ...after[4], message: 'Has 2 gaps.' }], [after[4]])).toEqual([]);
    expect(introducedText([])).toBe('No new warnings.');
    expect(introducedText([after[2]])).toBe('This write introduced 1 problem; fix it now:\n  [not-proved] TL-UC01-R02: Not proved.');
  });
});

describe('a strict product\'s gaps', () => {
  const warning = (check: string, record: string, message: string) => ({ severity: 'warning' as const, check, record, message });
  const setting = (product: string, strict: boolean, accepted?: number) => ({ product_id: product, max_children: 15, max_entities_per_aggregate: 7, technology_words: [], ...(strict ? { strict_check: true } : {}), ...(accepted ? { accepted_warnings: accepted } : {}) });
  const scope = (product: string, domain: string | null, gaps: number) => ({ product, domain, gaps: Array.from({ length: gaps }, (_, i) => ({ id: `${product}-R0${i}`, kind: 'uc_requirement', missing: 'proved', message: 'Not proved yet.' })) });
  const products = (...ids: string[]) => ids.map((id) => ({ id, kind: 'product', product: id }));

  it('LA-CHK-UC01-R12-T02 A strict product\'s check fails with one strict-gaps error at one gap or more and passes at none; a product that is not strict never fails on gaps', () => {
    const settings = [setting('TL', true, 1), setting('LA', true), setting('EX', false)];
    const warned = [warning('not-proved', 'TL-R09', 'Not proved.')];
    const productOf = (record: string) => record.split('-')[0];
    // TL has one gap in its own scope and none in its domain, LA none, EX three.
    const coverage = [scope('TL', null, 1), scope('TL', 'TL-LEND', 0), scope('LA', null, 0), scope('EX', 'EX-LEND', 3)];
    const problems = strictProblems(settings, warned, coverage, productOf);
    expect(problems).toEqual([{ severity: 'error', check: 'strict-gaps', record: 'TL', message: expect.stringContaining("Product TL's check is strict, so any gap fails it, and it has 1 gap: list them with coverage_gaps_list_coverage_gaps") }]);
    expect(problems[0].message).toContain('no count of gaps is ever accepted');
    // At zero gaps TL passes.
    expect(strictProblems(settings, warned, [scope('TL', null, 0)], productOf)).toEqual([]);
    const judged = strictnessOfProducts(settings, { records: [...products('TL', 'LA', 'EX'), { id: 'TL-R09', kind: 'uc_requirement', product: 'TL' }], problems: [...warned, ...problems], coverage });
    expect(judged.map(({ product, gaps, failures }) => ({ product, gaps, failures: failures.length }))).toEqual([{ product: 'TL', gaps: 1, failures: 1 }, { product: 'LA', gaps: 0, failures: 0 }, { product: 'EX', gaps: 3, failures: 0 }]);
    expect(strictSummary(judged[0])).toBe('TL is strict: warnings and gaps fail; it accepts 1 warning (a recorded deviation), and has 1 warning and 1 gap, so its check fails: 1 gap, and no gap is accepted.');
    expect(strictSummary(judged[1])).toBe('LA is strict: warnings and gaps fail; it accepts none, and has 0 warnings and 0 gaps.');
    expect(strictSummary(judged[2])).toBe('');
  });
});
