// The ERD read (LA-EXP-RM04, LA-EXP-QRY10): a product's one entity-relationship diagram, each domain a region, its
// aggregates boundaries around their entities (the root first) with their fields and types, and the has one, has many
// and reference-by-ID lines between entities, read through the read model's reader.
import { afterEach, describe, expect, it } from 'vitest';
import { GET_ERD } from '../../../src/exploring/erd/queries.ts';
import type { ErdMap } from '../../../src/exploring/erd/read-model.ts';
import { runQuery } from '../../../src/platform/commands/run.ts';
import type { ReadView } from '../../../src/platform/data/rules.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { writeData } from '../../helpers.ts';
import { TWO_PRODUCTS } from '../../checking/problems/data-set.ts';

const open: Store[] = [];
afterEach(async () => { for (const s of open.splice(0)) await s.close(); });

/** The two products, with a second aggregate in EX: Member, whose loan holds a reference to it and a line to its root. */
async function data(): Promise<ReadView> {
  const store = await openStore(writeData({
    ...TWO_PRODUCTS,
    aggregate: [
      ...TWO_PRODUCTS.aggregate!,
      { id: 'EX-LEND-A2', title: 'Member', domain_id: 'EX-LEND', identity: 'Member ID', description: 'A member who borrows tools.' },
      { id: 'EX-LEND-A3', title: 'Shelf', domain_id: 'EX-LEND', identity: 'Shelf ID', description: 'Where tools wait.' },
    ],
    entity: [
      ...TWO_PRODUCTS.entity!,
      { id: 'EX-LEND-EN02', title: 'Return', aggregate_id: 'EX-LEND-A1', role: 'child', description: 'The return of the loan.' },
      { id: 'EX-LEND-EN03', title: 'Member', aggregate_id: 'EX-LEND-A2', role: 'root', description: 'The member.' },
    ],
    entity_field: [
      { entity_id: 'EX-LEND-EN01', position: 1, name: 'Borrower', meaning: 'Who borrowed it.', type_aggregate_id: 'EX-LEND-A2', required: true },
      { entity_id: 'EX-LEND-EN03', position: 1, name: 'Email', meaning: 'Where the member gets mail.', type_value_object_id: 'EX-VO01', required: true },
    ],
    has_one: [{ source_id: 'EX-LEND-EN01', target_id: 'EX-LEND-EN02' }],
  }));
  open.push(store);
  return { schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id) };
}

describe('LA-EXP-QRY10-T01 The ERD read gives a product\'s domains, aggregates with their entities (root first) and fields, and its lines, nothing of another product', () => {
  it('reads EX\'s map', async () => {
    const map = runQuery(await data(), GET_ERD, { product_id: 'EX' }) as ErdMap;
    expect(map.product).toBe('EX');
    expect(map.boxes.map((b) => `${b.kind} ${b.id}${b.root ? ' root' : ''}${b.empty ? ' empty' : ''}`)).toEqual([
      'domain EX-LEND', 'aggregate EX-LEND-A1', 'entity EX-LEND-EN01 root', 'entity EX-LEND-EN02', 'aggregate EX-LEND-A2', 'entity EX-LEND-EN03 root', 'aggregate EX-LEND-A3 empty',
    ]);
    expect(map.boxes.find((b) => b.id === 'EX-LEND-EN03')!.fields).toEqual([{ field: 'Email', kind: 'Email address' }]);
    expect(map.boxes.find((b) => b.id === 'EX-LEND-EN01')!.fields).toEqual([{ field: 'Borrower', kind: '→ Member' }]);
    expect(map.lines).toEqual([
      { id: 'EX-LEND-EN01|has_one|EX-LEND-EN02', source: 'EX-LEND-EN01', target: 'EX-LEND-EN02', relation: 'has_one', sourceEnd: 'one', targetEnd: 'one', dashed: false, via: [] },
      { id: 'EX-LEND-EN01|references|EX-LEND-EN03', source: 'EX-LEND-EN01', target: 'EX-LEND-EN03', relation: 'references', sourceEnd: 'none', targetEnd: 'arrow', dashed: true, via: ['Loan.Borrower'] },
    ]);
    // Another product's map holds only its own domain, an empty region.
    const nf = runQuery(await data(), GET_ERD, { product_id: 'NF' }) as ErdMap;
    expect(nf.boxes).toEqual([{ id: 'NF-NOTE', kind: 'domain', title: 'Notes', root: false, fields: [], empty: true }]);
    expect(nf.lines).toEqual([]);
  });

  it('refuses a product that is not there', async () => {
    const view = await data();
    expect(() => runQuery(view, GET_ERD, { product_id: 'NOPE' })).toThrow(StoreError);
  });
});
