// A product's own checks: rows of its data/check.jsonl with its product_id, run after Lathe's built-in checks
// (lathe/data/check.jsonl), against the same tables, and reporting only on records of their product.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LATHE_DATA_DIR, loadWorkspace, openStore, StoreError, type Workspace } from '../src/index.ts';
import { adding, build, complete, loadData, ofCheck, removeData, writeData } from './helpers.ts';

const latheChecks = readFileSync(path.join(LATHE_DATA_DIR, 'check.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line).name as string);

const row = (name: string, position: number, query: string) => ({
  name, product_id: 'EX', position, severity: 'warning', summary: `The house rule ${name}.`, explanation: 'Made for this test. Fix what it reports.', query,
});

/** The complete product with a domain event nothing hears (a house rule here), two house checks and a product beside it. */
const house = () =>
  adding(complete(), {
    product: [{ id: 'OT', title: 'Other product' }],
    domain: [{ id: 'OT-D', title: 'Other', product_id: 'OT', subdomain_type: 'generic' }],
    check: [
      // One unheard event per aggregate; it returns a check column of its own, which is ignored.
      row('every-event-heard', 1, `SELECT e.id AS record, 'house-rule' AS check, 'Domain event ' || e.id || ' is heard by no policy.' AS message
FROM domain_event e WHERE NOT EXISTS (SELECT 1 FROM hears h WHERE h.target_id = e.id) ORDER BY record`),
      row('broken', 2, 'SELECT * FROM no_such_table'),
      // A product's check reports only on its own product's records, and on none.
      row('every-domain', 3, "SELECT id AS record, 'Domain ' || id || '.' AS message FROM domain UNION ALL SELECT NULL, 'Workspace.' ORDER BY record NULLS LAST"),
    ],
  });

let ws: Workspace;
beforeAll(async () => {
  // A Lathe check reports something too: a technical file not written yet.
  ws = await loadData(house(), { missing: ['src/dates.ts'] });
});
afterAll(removeData);

describe("a product's own checks", () => {
  it("LA-CHK-DS01-T01 Lathe's checks run first, then the product's, each by position", () => {
    const checks = ws.problems.map((p) => p.check);
    const firstProduct = checks.indexOf('every-event-heard');
    expect(firstProduct).toBeGreaterThan(-1);
    const lastLathe = checks.reduce((last, check, i) => (latheChecks.includes(check) ? i : last), -1);
    expect(lastLathe).toBeGreaterThan(-1);
    expect(lastLathe).toBeLessThan(firstProduct);
    expect(checks.slice(firstProduct)).toEqual(['every-event-heard', 'broken', 'every-domain', 'every-domain']);
  });

  it("LA-CHK-UC05-R01-T01 A product check runs against the same tables as Lathe's", () => {
    expect(ofCheck(ws, 'every-event-heard')).toEqual([{ severity: 'warning', check: 'every-event-heard', record: 'EX-LEND-EV02', message: 'Domain event EX-LEND-EV02 is heard by no policy.' }]);
  });

  it("LA-CHK-UC05-R02-T01 A product check's name comes from its row, not from a check column its query returns", () => {
    expect(ofCheck(ws, 'house-rule')).toEqual([]);
  });

  it("LA-CHK-UC05-R01-T02 A product check reports only on its own product's records, and on none", () => {
    expect(ofCheck(ws, 'every-domain').map((p) => p.record)).toEqual(['EX-LEND', null]);
  });

  /** The complete product, built, with a store open on it, and a product check named like one of Lathe's. */
  const clashing = async () => {
    const root = await build(complete());
    return { root, store: await openStore(root), check: row('view-unused', 1, "SELECT NULL AS record, 'THIS PRODUCT CHECK RAN' AS message") };
  };

  it("LA-CHK-INV01-T A product check named like one of Lathe's checks is refused by the store, naming Lathe's file", async () => {
    const { store, check } = await clashing();
    const clash = store.add('check', { ...check, severity: 'error' });
    await expect(clash).rejects.toThrow(StoreError);
    await expect(clash).rejects.toMatchObject({ problems: [expect.objectContaining({ rule: 'primary-key', message: expect.stringContaining("one of Lathe's own (lathe/data/check.jsonl)") })] });
    await store.close();
  });

  it("LA-CHK-UC05-R03-T01 A product check named like one of Lathe's checks never runs: written into the data file, it is refused when the data loads", async () => {
    const { root, store } = await clashing();
    await store.close();
    writeFileSync(path.join(root, 'data', 'check.jsonl'), `${JSON.stringify(row('view-unused', 1, 'SELECT 1'))}\n`);
    const loaded = await loadWorkspace(root);
    expect(ofCheck(loaded, 'data-refused')).toEqual([expect.objectContaining({ severity: 'error', message: expect.stringContaining('check view-unused is already on lathe/data/check.jsonl') })]);
  });

  it('LA-CHK-UC05-R04-T01 A product check that fails to run is an error naming the check', () => {
    const found = ofCheck(ws, 'broken');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'error', record: null });
    expect(found[0].message).toContain('The check broken could not run');
  });

  it('LA-CHK-UC05-R05-T01 A product names no checks folder: lathe.config.json refuses a checks setting, since checks are rows', async () => {
    const root = writeData({});
    writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ checks: 'nowhere' }));
    await expect(loadWorkspace(root)).rejects.toThrow('unknown setting "checks"');
  });

  it("LA-CHK-UC05-R01-T03 Without check rows of its own only Lathe's checks run", () => {
    const own = new Set(['every-event-heard', 'broken', 'every-domain']);
    expect(ws.problems.filter((p) => !own.has(p.check)).every((p) => latheChecks.includes(p.check))).toBe(true);
    expect(ws.problems.filter((p) => !own.has(p.check)).map((p) => p.check)).toEqual(['technical-file-missing', 'not-built']);
  });
});
