// The Record changes read (LA-EXP-RM07, LA-EXP-QRY13): what changed in a product's records since a baseline, read from
// the rows now and the baseline the server reads for the query's `since`, through the read model's reader.
import { afterEach, describe, expect, it } from 'vitest';
import { LIST_RECORD_CHANGES } from '../../src/exploring/record-changes/queries.ts';
import type { ProductChanges } from '../../src/exploring/record-changes/read-model.ts';
import type { ReadView } from '../../src/platform/data/rules.ts';
import { runQuery } from '../../src/platform/commands/run.ts';
import type { Store } from '../../src/platform/data/store.ts';
import type { BaselineAnswer } from '../../src/server/contract.ts';
import { closeTwoProducts, twoProducts } from '../checking/problems/data-set.ts';

afterEach(closeTwoProducts);

const withBaseline = (store: Store, baseline?: BaselineAnswer): ReadView => ({ schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id), baseline });

/** The store's rows, every stored table's, with a change made to them: the baseline a commit would hold. */
function tablesOf(store: Store, change: (tables: Record<string, Record<string, unknown>[]>) => void) {
  const tables = Object.fromEntries(Object.values(store.schema.tables).filter((t) => t.stored).map((t) => [t.name, structuredClone(store.rows(t.name))]));
  change(tables);
  return tables as Extract<BaselineAnswer, { state: 'ok' }>['tables'];
}

describe('LA-EXP-UC15-R01-T02 What changed since a baseline is read per product, by record, from the rows now and the baseline', () => {
  it('lists each record added, removed and changed in the product, and nothing of another product', async () => {
    const store = await twoProducts();
    const tables = tablesOf(store, (t) => {
      t.invariant = [];
      t.aggregate[0].title = 'Lending';
      t.domain.push({ id: 'EX-GONE', title: 'Gone', product_id: 'EX', position: 2, subdomain_type: 'core', description: 'Removed since.' });
      t.domain = t.domain.filter((d) => d.id !== 'NF-NOTE');
    });
    const view = withBaseline(store, { state: 'ok', commit: 'abc123', short: 'abc123', subject: 'Before', date: '2026-10-01', base: null, tables });
    const ex = runQuery(view, LIST_RECORD_CHANGES, { product_id: 'EX', since: 'commit' }) as ProductChanges;
    expect(ex.baseline).toMatchObject({ state: 'ok', short: 'abc123', subject: 'Before' });
    expect(ex.changes.map((c) => [c.id, c.change])).toEqual(expect.arrayContaining([['EX-LEND-INV01', 'added'], ['EX-LEND-A1', 'changed'], ['EX-GONE', 'removed']]));
    expect(ex.changes.find((c) => c.id === 'EX-LEND-A1')!.fields).toEqual([{ name: 'title', before: 'Lending', after: 'Loan' }]);
    expect(ex.changes.some((c) => c.id.startsWith('NF'))).toBe(false);
    const nf = runQuery(view, LIST_RECORD_CHANGES, { product_id: 'NF', since: 'commit' }) as ProductChanges;
    expect(nf.changes.map((c) => [c.id, c.change])).toEqual([['NF-NOTE', 'added']]);
  });

  it('says why there is no baseline, and lists no change', async () => {
    const store = await twoProducts();
    const ex = runQuery(withBaseline(store, { state: 'no-repo', message: 'This folder is not in a git repository.' }), LIST_RECORD_CHANGES, { product_id: 'EX', since: 'commit' }) as ProductChanges;
    expect(ex).toEqual({ product: 'EX', baseline: { state: 'none', message: 'This folder is not in a git repository.' }, changes: [] });
  });
});
