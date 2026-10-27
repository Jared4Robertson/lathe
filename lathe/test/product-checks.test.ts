// A product's own checks: rows of its data/check.jsonl with its product_id, run after Lathe's built-in checks
// (lathe/data/check.jsonl), against the same tables.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LATHE_DATA_DIR, loadWorkspace, openStore, StoreError, type Workspace } from '../src/index.ts';
import { fixture, load, ofCheck } from './helpers.ts';

const latheChecks = readFileSync(path.join(LATHE_DATA_DIR, 'check.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line).name as string);
const temps: string[] = [];
const temp = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lathe-product-checks-'));
  temps.push(dir);
  return dir;
};

const workspaces: Record<string, Workspace> = {};
beforeAll(async () => {
  for (const name of ['product-checks-house', 'product-checks-unbacked', 'good']) workspaces[name] = await load(name);
});
afterAll(() => { for (const dir of temps) rmSync(dir, { recursive: true, force: true }); });

describe("a product's own checks", () => {
  it("LA-CHK-T23 A product check runs after Lathe's checks, against the same tables", () => {
    const ws = workspaces['product-checks-house'];
    const checks = ws.problems.map((p) => p.check);
    const firstProduct = checks.indexOf('one-record-view-per-aggregate');
    expect(firstProduct).toBeGreaterThan(-1);
    // Every Lathe check's problem comes before every product check's problem.
    const lastLathe = checks.reduce((last, check, i) => (latheChecks.includes(check) ? i : last), -1);
    expect(lastLathe).toBeGreaterThan(-1);
    expect(lastLathe).toBeLessThan(firstProduct);
    // The product check read the typed tables, as Lathe's checks do, and its severity comes from its row.
    expect(ofCheck(ws, 'one-record-view-per-aggregate').every((p) => p.severity === 'warning')).toBe(true);
  });

  it("LA-CHK-T24 A product check's name comes from its row, not from a check column its query returns", () => {
    const ws = workspaces['product-checks-house'];
    // The query of one-record-view-per-aggregate returns 'house-rule' in a check column.
    expect(ofCheck(ws, 'house-rule')).toEqual([]);
    expect(ofCheck(ws, 'one-record-view-per-aggregate')).toHaveLength(2);
  });

  it('LA-CHK-T25 A one Record view use case per aggregate house rule is carried as a product check', () => {
    const found = ofCheck(workspaces['product-checks-house'], 'one-record-view-per-aggregate');
    // PC-D-A1 has one; PC-D-A2 has none (PC-D-UC04 follows no pattern); PC-D-A3 has two.
    expect(found.map((p) => p.record)).toEqual(['PC-D-A2', 'PC-D-A3']);
    expect(found[0].message).toContain('0 Record view use cases');
    expect(found[1].message).toContain('PC-D-UC02, PC-D-UC03');
  });

  it("LA-CHK-T26 A product check named like one of Lathe's checks is refused by the store, so it never runs", async () => {
    const root = temp();
    cpSync(fixture('product-checks-house'), root, { recursive: true });
    const store = await openStore(root);
    const clash = store.add('check', {
      name: 'unproved', product_id: 'PC', position: 3, severity: 'error', summary: 'Named like a check of Lathe\'s.',
      explanation: 'It must not run.', query: "SELECT NULL AS record, 'THIS PRODUCT CHECK RAN' AS message",
    });
    await expect(clash).rejects.toThrow(StoreError);
    await expect(clash).rejects.toMatchObject({ problems: [expect.objectContaining({ rule: 'primary-key', message: expect.stringContaining("one of Lathe's own (lathe/data/check.jsonl)") })] });
    await store.close();
    // The same row written into the data file is refused when the data loads.
    const file = path.join(root, 'data', 'check.jsonl');
    writeFileSync(file, `${readFileSync(file, 'utf8')}${JSON.stringify({ name: 'unproved', product_id: 'PC', position: 3, severity: 'error', summary: 'Clash.', explanation: 'Clash.', query: 'SELECT 1' })}\n`);
    const ws = await loadWorkspace(root);
    expect(ofCheck(ws, 'data-refused')).toEqual([expect.objectContaining({ severity: 'error', message: expect.stringContaining('check unproved is already on lathe/data/check.jsonl') })]);
    expect(ws.problems.some((p) => p.message.includes('THIS PRODUCT CHECK RAN'))).toBe(false);
  });

  it('LA-CHK-T27 A product check that fails to run is an error naming the check', () => {
    const found = ofCheck(workspaces['product-checks-house'], 'broken');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'error', record: null });
    expect(found[0].message).toContain('The check broken could not run');
  });

  it('LA-CHK-T28 A product names no checks folder: lathe.config.json refuses a checks setting, since checks are rows', async () => {
    const root = temp();
    writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ checks: 'nowhere' }));
    await expect(loadWorkspace(root)).rejects.toThrow('unknown setting "checks"');
  });

  it("LA-CHK-T29 Without check rows of its own only Lathe's checks run", () => {
    const ws = workspaces.good;
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(ws.problems.every((p) => latheChecks.includes(p.check))).toBe(true);
  });
});

describe('the unproved check counts only backed proof', () => {
  it('LA-TRC-T45 An automated test whose file backs neither its ID nor its claim leaves the obligation unproved, as coverage does', () => {
    const ws = workspaces['product-checks-unbacked'];
    expect(ofCheck(ws, 'unproved').map((p) => p.record)).toEqual(['PU-D-DR01']);
    expect(ofCheck(ws, 'proof-not-in-file').map((p) => p.record)).toEqual(['PU-D-T01']);
    const rules = ws.coverage[0].obligations.find((o) => o.kind === 'domain_rule');
    expect(rules).toMatchObject({ total: 3, proved: 2 });
    expect(ws.coverage[0].gaps).toEqual([{ id: 'PU-D-DR01', kind: 'domain_rule', missing: 'proves' }]);
  });
});
