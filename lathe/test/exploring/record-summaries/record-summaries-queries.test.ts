// The Record summaries read (LA-EXP-RM01, LA-EXP-QRY01): every record of a product's space as its pages name it, placed
// as the records' scope places it, with a digest of its rows and the links among them, read through the read model's
// reader; no column of a record beyond its summary.
import { afterEach, describe, expect, it } from 'vitest';
import { LIST_RECORD_SUMMARIES } from '../../../src/exploring/record-summaries/queries.ts';
import { summariesIn, type RecordSummaries, type RecordSummary, type SummaryLink } from '../../../src/exploring/record-summaries/read-model.ts';
import { runQuery } from '../../../src/platform/commands/run.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { writeData, type Data } from '../../helpers.ts';
import { TWO_PRODUCTS } from '../../checking/problems/data-set.ts';

const open: Store[] = [];
afterEach(async () => { for (const s of open.splice(0)) await s.close(); });

/** The two products, with the loan's entity typing a field by the value object (so only EX-LEND uses it) and a test. */
const DATA: Data = {
  ...TWO_PRODUCTS,
  entity_field: [{ entity_id: 'EX-LEND-EN01', position: 1, name: 'Contact', meaning: 'Where the borrower gets mail.', type_value_object_id: 'EX-VO01', required: true }],
  invariant_test: [{ id: 'EX-LEND-INV01-T01', title: 'A second loan is refused', invariant_id: 'EX-LEND-INV01', level: 'unit', state: 'automated', file: 'test/loan.test.ts', when: 'Lends a lent tool.', then: 'Refused.' }],
  has_one: [],
};

/** The product's space, with its records as summaries. */
async function summaries(data: Data, product: string): Promise<{ records: RecordSummary[]; links: SummaryLink[] }> {
  const store = await openStore(writeData(data));
  open.push(store);
  const answer = runQuery({ schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id) }, LIST_RECORD_SUMMARIES, { product_id: product }) as RecordSummaries;
  // Each record is its values in the order of the columns, which the answer names once.
  expect(answer.columns).toEqual(['id', 'kind', 'title', 'parent', 'product', 'domain', 'group', 'testState', 'names', 'level', 'file', 'line', 'digest']);
  expect(answer.records.every((values) => values.length === answer.columns.length)).toBe(true);
  return { records: summariesIn(answer), links: answer.links };
}

describe('LA-EXP-UC02-R08-T02 The record summaries read places each record of a product\'s space, gives its file, line and digest, and the links among them', () => {
  it('places records up their parents, by their ID, and a value object in the one domain that uses it; nothing of another product', async () => {
    const s = await summaries(DATA, 'EX');
    const at = (id: string) => s.records.find((r) => r.id === id);
    expect(s.records.map((r) => r.id)).not.toContain('NF-NOTE');
    expect(at('EX-LEND-INV01')).toMatchObject({ kind: 'invariant', parent: 'EX-LEND-A1', product: 'EX', domain: 'EX-LEND' });
    expect(at('EX-LEND-SP01')).toMatchObject({ parent: null, product: 'EX', domain: 'EX-LEND' });
    expect(at('EX-VO01')).toMatchObject({ parent: null, product: 'EX', domain: 'EX-LEND' });
    expect(at('EX-VO01-C01')).toMatchObject({ parent: 'EX-VO01', domain: 'EX-LEND' });
    expect(at('EX-PAT-ACT')).toMatchObject({ product: 'EX', domain: null });
    expect(at('EX-LEND-INV01-T01')).toMatchObject({ testState: 'automated', level: 'unit', names: 'test/loan.test.ts', file: 'invariant_test.jsonl', line: 1 });
    expect(at('EX-LEND-A1')).toMatchObject({ testState: null, level: null, names: null });
    expect(Object.keys(at('EX-LEND-A1')!).sort()).toEqual(['digest', 'domain', 'file', 'group', 'id', 'kind', 'level', 'line', 'names', 'parent', 'product', 'testState', 'title']);
  });

  it('leaves a value object two domains use, or none, in no domain', async () => {
    const s = await summaries(TWO_PRODUCTS, 'EX');
    expect(s.records.find((r) => r.id === 'EX-VO01')).toMatchObject({ product: 'EX', domain: null });
  });

  it('gives the links among the space\'s records, and a digest that changes when a part row does', async () => {
    const linked = await summaries({ ...DATA, entity: [...DATA.entity!, { id: 'EX-LEND-EN02', title: 'Return', aggregate_id: 'EX-LEND-A1', role: 'child', description: 'The return.' }], has_one: [{ source_id: 'EX-LEND-EN01', target_id: 'EX-LEND-EN02' }] }, 'EX');
    expect(linked.links).toContainEqual({ source: 'EX-LEND-EN01', relation: 'has_one', target: 'EX-LEND-EN02' });
    const before = (await summaries(DATA, 'EX')).records.find((r) => r.id === 'EX-LEND-EN01')!.digest;
    const after = (await summaries({ ...DATA, entity_field: [{ ...DATA.entity_field![0], meaning: 'Where to write.' }] }, 'EX')).records.find((r) => r.id === 'EX-LEND-EN01')!.digest;
    const same = (await summaries(DATA, 'EX')).records.find((r) => r.id === 'EX-LEND-EN01')!.digest;
    expect(after).not.toBe(before);
    expect(same).toBe(before);
  });

  it('refuses a product that is not there', async () => {
    await expect(summaries(DATA, 'ZZ')).rejects.toBeInstanceOf(StoreError);
  });
});
