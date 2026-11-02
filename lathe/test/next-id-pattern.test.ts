// Every aggregate's next-id query agrees with its kind's id_pattern in the schema: asked for the next ID under the parent
// of each numbered record of Lathe's own spec, it answers the same prefix and at least its digits, one past the highest in use.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_QUERIES } from '../src/commands.ts';
import { openStore } from '../src/index.ts';
import { runQuery } from '../src/platform/commands/run.ts';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The queries whose input is a single parent, with the kind they number. */
const SINGLE: Record<string, string> = {
  '/api/business-outcome/next-id': 'business_outcome',
  '/api/entry-point/next-id': 'entry_point',
  '/api/tooling/next-id': 'tooling',
  '/api/test-data-set/next-id': 'test_data_set',
  '/api/ui-component/next-id': 'ui_component',
  '/api/table/next-id': 'table',
};

describe('LA-UCS-UC06-R08-T02 next-id queries and the schema', () => {
  it('every next-id query answers the shape its kind\'s id_pattern gives', async () => {
    const store = await openStore(REPO, { dataDir: path.join(REPO, 'data') });
    try {
      const queries = ALL_QUERIES.filter((q) => q.route.endsWith('/next-id') && !q.route.includes('extension-record'));
      expect(queries.length).toBe(23);
      const covered = new Set<string>();
      for (const [kind, described] of Object.entries(store.schema.kinds)) {
        if (!/<n+>$/.test(described.idPattern?.split(/,? or /).pop() ?? '')) continue;
        for (const row of store.rows(kind)) {
          const own = String(row.id);
          const number = /(\d+)$/.exec(own);
          if (!number) continue;
          const column = described.parents.map((p) => p.column).find((c) => row[c]);
          const parent = column ? String(row[column]) : own.slice(0, own.lastIndexOf('-'));
          for (const query of queries) {
            const single = SINGLE[query.route];
            if (single && single !== kind) continue;
            let next: string;
            try {
              next = String(runQuery(store, query, single ? { [Object.keys(query.input)[0]]: parent }: { kind, parent }));
            } catch {
              continue;
            }
            covered.add(kind);
            expect(next.replace(/\d+$/, ''), `${query.route} for ${own}`).toBe(own.replace(/\d+$/, ''));
            expect(next.length, `${query.route} for ${own}`).toBeGreaterThanOrEqual(own.length);
            // A flow's number is its interface's, not one past the highest.
            if (kind !== 'flow') expect(Number(/(\d+)$/.exec(next)![1]), `${query.route} for ${own}`).toBeGreaterThan(Number(number[1]));
          }
        }
      }
      expect(covered.size).toBeGreaterThan(30);
    } finally {
      await store.close();
    }
  }, 120_000);
});
