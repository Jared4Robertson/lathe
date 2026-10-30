// The Coverage read (LA-TRC-RM01, LA-TRC-QRY01): a product's coverage scope by scope (its own records outside every
// domain first, then each domain), read from the checks' run through the read model's reader, nothing of another product.
import { afterEach, describe, expect, it } from 'vitest';
import { GET_COVERAGE } from '../../../src/traceability/coverage/queries.ts';
import type { ProductCoverage } from '../../../src/traceability/coverage/read-model.ts';
import { runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Coverage } from '../../../src/types.ts';
import { closeTwoProducts, twoProducts } from '../../checking/problems/data-set.ts';

afterEach(closeTwoProducts);

const scope = (product: string, domain: string | null, proved: number): Coverage => ({
  product, domain,
  obligations: [{ kind: 'invariant', label: 'Invariant', total: 2, designed: 2, built: 1, proved, not_automated: 1, proof_only: false }],
  tests: { automated: proved, manual: 0, not_automated: 1 },
  proved_by: {}, pattern_rules: {},
  gaps: [{ id: `${domain ?? product}-X`, kind: 'invariant', missing: 'proved', message: 'not proved' }],
});

describe('LA-TRC-UC01-R01-T02 A product\'s coverage gives each scope\'s figures, tests by state and gaps, its own scope first, nothing of another product', () => {
  it('reads EX\'s scopes from the run', async () => {
    const store = await twoProducts();
    const view = { schema: store.schema, rows: (t: string) => store.rows(t), record: (id: string) => store.record(id), checked: { problems: [], chains: [], coverage: [scope('EX', 'EX-LEND', 1), scope('EX', null, 0), scope('NF', 'NF-NOTE', 2)] } };
    const ex = runQuery(view, GET_COVERAGE, { product_id: 'EX' }) as ProductCoverage;
    expect(ex.scopes.map((s) => s.domain)).toEqual([null, 'EX-LEND']);
    expect(ex.scopes[1]).toEqual({
      domain: 'EX-LEND',
      obligations: [{ kind: 'invariant', label: 'Invariant', total: 2, designed: 2, built: 1, proved: 1, notAutomated: 1, proofOnly: false }],
      tests: { automated: 1, manual: 0, notAutomated: 1 },
      gaps: [{ id: 'EX-LEND-X', kind: 'invariant', missing: 'proved', message: 'not proved' }],
    });
    expect((runQuery(view, GET_COVERAGE, { product_id: 'NF' }) as ProductCoverage).scopes.map((s) => s.domain)).toEqual(['NF-NOTE']);
    expect(() => runQuery(view, GET_COVERAGE, { product_id: 'NOPE' })).toThrow(StoreError);
  });
});
