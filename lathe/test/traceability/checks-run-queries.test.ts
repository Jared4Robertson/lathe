// The reads of the checks' run that the CLI's steps ask for, each from its read model's reader: a product's coverage
// gaps and its unused packages (LA-TRC-RM02), its tests by state (LA-TRC-RM03), its addresses traced both ways
// (LA-TRC-RM05) and its stored kinds' parts their files do not define (LA-TRC-RM07). Each reads only what the run
// found for its own product, and refuses a product that does not exist.
import { afterEach, describe, expect, it } from 'vitest';
import { FIND_UNUSED_PACKAGES, LIST_COVERAGE_GAPS } from '../../src/traceability/coverage-gaps/queries.ts';
import { GET_TEST_COUNTS } from '../../src/traceability/tests-by-state/queries.ts';
import { LIST_TRACED_ADDRESSES } from '../../src/traceability/file-facts/queries.ts';
import { FIND_UNDEFINED_STORED_KINDS } from '../../src/traceability/stored-record-facts/queries.ts';
import { answerQuery, runQuery } from '../../src/platform/commands/run.ts';
import { StoreError } from '../../src/platform/data/problems.ts';
import type { Coverage, CoverageGap, Problem } from '../../src/types.ts';
import type { Store } from '../../src/platform/data/store.ts';
import { closeTwoProducts, twoProducts } from '../checking/problems/data-set.ts';

afterEach(closeTwoProducts);

const scope = (product: string, domain: string | null, gaps: CoverageGap[], automated = 1): Coverage => ({
  product, domain, obligations: [], proved_by: {}, pattern_rules: [], debt: [], gaps,
  tests: { automated, manual: 2, not_automated: 3 },
});
const gap = (id: string, missing: string): CoverageGap => ({ id, kind: 'invariant', missing, message: `${id} ${missing}` });
const problem = (check: string, record: string): Problem => ({ severity: 'warning', check, record, message: `${record} ${check}` });

async function viewOf(coverage: Coverage[], problems: Problem[] = []) {
  const store: Store = await twoProducts();
  return { store, view: { schema: store.schema, rows: (t: string) => store.rows(t), record: (id: string) => store.record(id), checked: { problems, chains: [], coverage } } };
}

const gapScopes = () => [
  scope('EX', 'EX-LEND', [gap('EX-LEND-INV01', 'proved')]),
  scope('EX', null, [gap('EX', 'package-not-accounted-for'), gap('EX', 'route-without-record')]),
  scope('NF', 'NF-NOTE', [gap('NF-NOTE', 'proved')]),
];

describe('LA-TRC-UC01-R02-T03 The coverage gaps read lists each gap of a product with what it lacks, its own scope first, nothing of another product', () => {
  it('lists EX\'s gaps from the run', async () => {
    const { view } = await viewOf(gapScopes());
    expect(runQuery(view, LIST_COVERAGE_GAPS, { product_id: 'EX' })).toEqual({
      product: 'EX',
      gaps: [
        { domain: null, id: 'EX', kind: 'invariant', missing: 'package-not-accounted-for', message: 'EX package-not-accounted-for' },
        { domain: null, id: 'EX', kind: 'invariant', missing: 'route-without-record', message: 'EX route-without-record' },
        { domain: 'EX-LEND', id: 'EX-LEND-INV01', kind: 'invariant', missing: 'proved', message: 'EX-LEND-INV01 proved' },
      ],
    });
    expect(() => runQuery(view, LIST_COVERAGE_GAPS, { product_id: 'NOPE' })).toThrow(StoreError);
  });

  it('reads the checks\' run, so it refuses data without one', async () => {
    const { store } = await viewOf([]);
    expect(() => answerQuery(store, LIST_COVERAGE_GAPS, { product_id: 'EX' })).toThrow(/LA-TRC-QRY02 reads the checks' run/);
  });
});

describe('LA-TRC-UC19-R01-T02 The unused packages read gives the product\'s one package-not-accounted-for gap, or none', () => {
  it('finds EX\'s gap and none for NF', async () => {
    const { view } = await viewOf(gapScopes());
    expect(runQuery(view, FIND_UNUSED_PACKAGES, { product_id: 'EX' })).toEqual({ product: 'EX', gaps: [expect.objectContaining({ id: 'EX', missing: 'package-not-accounted-for' })] });
    expect(runQuery(view, FIND_UNUSED_PACKAGES, { product_id: 'NF' })).toEqual({ product: 'NF', gaps: [] });
  });
});

describe('LA-TRC-UC06-R02-T02 The tests by state read counts each scope\'s tests as automated, manual and not automated yet, the product\'s own scope first', () => {
  it('counts each scope\'s tests from the run', async () => {
    const { view } = await viewOf([scope('EX', 'EX-LEND', [], 4), scope('EX', null, []), scope('NF', 'NF-NOTE', [])]);
    expect(runQuery(view, GET_TEST_COUNTS, { product_id: 'EX' })).toEqual({
      product: 'EX',
      scopes: [{ domain: null, automated: 1, manual: 2, notAutomated: 3 }, { domain: 'EX-LEND', automated: 4, manual: 2, notAutomated: 3 }],
    });
    expect(GET_TEST_COUNTS.text(runQuery(view, GET_TEST_COUNTS, { product_id: 'NF' }) as never)).toBe('NF\n  NF-NOTE: 1 automated · 2 manual · 3 not automated yet');
    expect(() => runQuery(view, GET_TEST_COUNTS, { product_id: 'NOPE' })).toThrow(StoreError);
  });
});

describe('LA-TRC-UC15-R03-T02 The addresses traced both ways read lists the product\'s addresses its files do not name and those its code serves with no record', () => {
  it('lists the address checks\' problems on the product\'s records and the addresses it serves with no record', async () => {
    const { view } = await viewOf(
      [scope('EX', null, [gap('EX', 'route-without-record'), gap('EX', 'package-not-accounted-for')]), scope('NF', null, [])],
      [problem('endpoint-route-not-in-file', 'EX-LEND-A1'), problem('view-route-not-in-file', 'NF-NOTE'), problem('unused', 'EX-LEND-INV01')],
    );
    expect(runQuery(view, LIST_TRACED_ADDRESSES, { product_id: 'EX' })).toEqual({
      product: 'EX',
      unnamed: [{ record: 'EX-LEND-A1', check: 'endpoint-route-not-in-file', message: 'EX-LEND-A1 endpoint-route-not-in-file' }],
      unrecorded: ['EX route-without-record'],
    });
    expect(runQuery(view, LIST_TRACED_ADDRESSES, { product_id: 'NF' })).toEqual({ product: 'NF', unnamed: [expect.objectContaining({ record: 'NF-NOTE' })], unrecorded: [] });
    expect(() => runQuery(view, LIST_TRACED_ADDRESSES, { product_id: 'NOPE' })).toThrow(StoreError);
  });
});

describe('LA-TRC-UC16-R01-T03 The stored kinds not defined read lists the product\'s table-schema-mismatch warnings alone', () => {
  it('lists the table-schema-mismatch warnings on the product\'s records alone', async () => {
    const { view } = await viewOf([], [problem('table-schema-mismatch', 'EX-LEND-A1'), problem('table-schema-mismatch', 'NF-NOTE'), problem('unused', 'EX-LEND-INV01')]);
    expect(runQuery(view, FIND_UNDEFINED_STORED_KINDS, { product_id: 'EX' })).toEqual({ product: 'EX', parts: [{ record: 'EX-LEND-A1', message: 'EX-LEND-A1 table-schema-mismatch' }] });
    expect(() => runQuery(view, FIND_UNDEFINED_STORED_KINDS, { product_id: 'NOPE' })).toThrow(StoreError);
  });
});
