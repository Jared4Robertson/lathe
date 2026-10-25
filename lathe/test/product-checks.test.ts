// A product's own checks: a `checks` folder in lathe.config.json, run after Lathe's checks (FORMAT.md section 13).
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { CHECKS_DIR, loadWorkspace, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const ofCheck = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check);
const latheChecks = readdirSync(CHECKS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => f.replace(/\.sql$/, '').replace(/^\d+[-_]/, ''));

const workspaces: Record<string, Workspace> = {};
beforeAll(async () => {
  for (const name of ['product-checks-house', 'product-checks-missing', 'product-checks-unbacked', 'good']) {
    workspaces[name] = await loadWorkspace(fixture(name));
  }
});

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
    // The product check read records, links and fields, as Lathe's checks do.
    expect(ofCheck(ws, 'one-record-view-per-aggregate').every((p) => p.severity === 'warning')).toBe(true);
  });

  it("LA-CHK-T24 A product check's name comes from its file name, not its check column", () => {
    const ws = workspaces['product-checks-house'];
    // 01-one-record-view-per-aggregate.sql returns 'house-rule' in its check column.
    expect(ofCheck(ws, 'house-rule')).toEqual([]);
    expect(ofCheck(ws, 'one-record-view-per-aggregate')).toHaveLength(2);
  });

  it("LA-CHK-T25 S2's one Record view use case per aggregate is carried as a product check", () => {
    const found = ofCheck(workspaces['product-checks-house'], 'one-record-view-per-aggregate');
    // PC-D-A1 has one; PC-D-A2 has none (PC-D-UC04 names it but follows no pattern); PC-D-A3 has two.
    expect(found.map((p) => p.record)).toEqual(['PC-D-A2', 'PC-D-A3']);
    expect(found[0].message).toContain('0 Record view use cases');
    expect(found[1].message).toContain('PC-D-UC02, PC-D-UC03');
  });

  it("LA-CHK-T26 A product check named like one of Lathe's checks is an error and is not run", () => {
    const ws = workspaces['product-checks-house'];
    expect(ofCheck(ws, 'product-check-name-clash')).toEqual([
      {
        severity: 'error',
        check: 'product-check-name-clash',
        record: null,
        message: expect.stringContaining('house-checks/02-unproved.sql'),
      },
    ]);
    expect(ws.problems.some((p) => p.message.includes('THIS PRODUCT CHECK RAN'))).toBe(false);
  });

  it('LA-CHK-T27 A product check that fails to run is an error naming its file', () => {
    const found = ofCheck(workspaces['product-checks-house'], 'broken');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'error', record: null });
    expect(found[0].message).toContain('The check house-checks/03-broken.sql could not run');
  });

  it('LA-CHK-T28 A configured checks folder that does not exist is an error', () => {
    const found = ofCheck(workspaces['product-checks-missing'], 'product-checks-missing');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'error', record: null });
    expect(found[0].message).toContain('nowhere');
  });

  it("LA-CHK-T29 Without a checks folder only Lathe's checks run", () => {
    const ws = workspaces.good;
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(ws.problems.every((p) => latheChecks.includes(p.check))).toBe(true);
  });
});

describe('the unproved check counts only backed proof', () => {
  it("LA-TRC-T45 An automated test whose file backs neither its ID nor its claim leaves the obligation unproved, as coverage does", () => {
    const ws = workspaces['product-checks-unbacked'];
    expect(ofCheck(ws, 'unproved').map((p) => p.record)).toEqual(['PU-D-DR01']);
    expect(ofCheck(ws, 'proof-not-in-file').map((p) => p.record)).toEqual(['PU-D-T01']);
    const rules = ws.coverage[0].obligations.find((o) => o.kind === 'domain_rule');
    expect(rules).toMatchObject({ total: 3, proved: 2 });
    expect(ws.coverage[0].gaps).toEqual([{ id: 'PU-D-DR01', kind: 'domain_rule', missing: 'proves' }]);
  });
});
