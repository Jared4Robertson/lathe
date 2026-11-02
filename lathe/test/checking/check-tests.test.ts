// LA-PAT-AGGREGATE-TESTS-R04: every check of Lathe's names one domain, tested in that domain's test folder
// (lathe/test/<domain>/checks.test.ts, the domain's title in kebab case), from a complete product that breaks none of them.
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

describe("LA-PAT-AGGREGATE-TESTS-R04-T01 LA-PAT-AGGREGATE-TESTS-R04-T04 LA-PAT-AGGREGATE-TESTS-R04-T05 LA-PAT-AGGREGATE-TESTS-R04-T06 LA-PAT-AGGREGATE-TESTS-R04-T07 LA-PAT-AGGREGATE-TESTS-R04-T08 LA-PAT-AGGREGATE-TESTS-R04-T02 LA-PAT-AGGREGATE-TESTS-R04-T03 every check of Lathe's has a test in its domain's folder that breaks it, from a product that breaks none", () => {
  it('the complete product breaks none of them', async () => {
    expect((await loadData(complete())).problems).toEqual([]);
  });

  it("each of Lathe's checks names its domain, and its domain's checks.test.ts tests it", async () => {
    const store = await openStore(path.dirname(LATHE_DATA_DIR), { latheDataDir: null });
    const checks = new Map(store.rows('check').map((r) => [String(r.name), String(r.domain_id)]));
    await store.close();
    const names = [...checks.keys()].sort();
    const domains = new Map(data('domain').map((d) => [d.id, String(d.title).toLowerCase().replaceAll(' ', '-')]));
    const untested = names.filter((name) => {
      const file = path.join(PACKAGE_DIR, 'test', domains.get(checks.get(name)!)!, 'checks.test.ts');
      return !readFileSync(file, 'utf8').includes(`'${name}'`);
    });
    expect(untested).toEqual([]);
  });
});
