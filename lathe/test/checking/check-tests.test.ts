// LA-STD-CODE-R05: every check of Lathe's is a check row of one domain, tested in that domain's test folder
// (lathe/test/<domain>/checks.test.ts), from a complete product that breaks none of them.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openStore, LATHE_DATA_DIR, PACKAGE_DIR } from '../../src/index.ts';
import { complete, loadData, removeData } from '../helpers.ts';

afterAll(removeData);

const REPO = path.join(PACKAGE_DIR, '..');

/** Lathe's own data, by table. */
const data = (table: string): Record<string, unknown>[] =>
  readFileSync(path.join(REPO, 'data', `${table}.jsonl`), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

describe("LA-STD-CODE-R05-T01 every check of Lathe's has a test in its domain's folder that breaks it, from a product that breaks none", () => {
  it('the complete product breaks none of them', async () => {
    expect((await loadData(complete())).problems).toEqual([]);
  });

  it("each of Lathe's checks is a check row of a domain, and its domain's checks.test.ts tests it", async () => {
    const store = await openStore(path.dirname(LATHE_DATA_DIR), { latheDataDir: null });
    const names = store.rows('check').map((r) => String(r.name)).sort();
    await store.close();
    const domains = new Map(data('domain').map((d) => [d.id, String(d.title).toLowerCase()]));
    const rows = new Map(data('check_row').filter((r) => r.file === 'lathe/data/check.jsonl').map((r) => [String(r.title), String(r.domain_id)]));
    expect(names.filter((n) => !rows.has(n)), 'checks with no check row').toEqual([]);
    const untested = names.filter((name) => {
      const file = path.join(PACKAGE_DIR, 'test', domains.get(rows.get(name))!, 'checks.test.ts');
      return !readFileSync(file, 'utf8').includes(`'${name}'`);
    });
    expect(untested).toEqual([]);
  });
});
