// The one record diff (LA-EXP-QRY13, lathe/src/changes.ts): what changed between two versions of a product's rows, by
// record, against a store made here, so the rows are the ones the command layer writes.
import { rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configuredRoot } from './store/fixture.ts';
import { applyDelta, recordChanges, rowDelta, type Tables } from '../src/changes.ts';
import { openStore, type Store } from '../src/store/index.ts';

let root = '';
let store: Store;

/** Every stored table's rows, as the store holds them now. */
const tablesOf = (s: Store): Tables => Object.fromEntries(Object.entries(s.schema.tables).filter(([, t]) => t.stored).map(([name]) => [name, s.rows(name)]));

beforeAll(async () => {
  root = configuredRoot('lathe-changes-');
  store = await openStore(root);
  await store.apply([
    { op: 'add', table: 'product', row: { id: 'EX', title: 'Example' } },
    { op: 'add', table: 'role', row: { product_id: 'EX', name: 'Writer' } },
    { op: 'add', table: 'domain', row: { id: 'EX-NOTE', title: 'Notes', product_id: 'EX', subdomain_type: 'core' } },
    { op: 'add', table: 'capability', row: { id: 'EX-NOTE-CAP01', title: 'Writing', domain_id: 'EX-NOTE', position: 1 } },
    { op: 'add', table: 'pattern', row: { id: 'EX-PAT-NOTE', title: 'A note action', product_id: 'EX' } },
    { op: 'add', table: 'use_case', row: { id: 'EX-NOTE-UC01', title: 'Write a note', capability_id: 'EX-NOTE-CAP01' } },
    { op: 'add', table: 'use_case', row: { id: 'EX-NOTE-UC02', title: 'Throw a note away', capability_id: 'EX-NOTE-CAP01' } },
  ]);
}, 60_000);

afterAll(async () => {
  await store?.close();
  rmSync(root, { recursive: true, force: true });
});

describe('the record diff', () => {
  it('LA-EXP-UC15-R01-T01 One definition of what changed: records added, removed and changed field by field, their part rows, and the links they start', async () => {
    const before = tablesOf(store);
    await store.apply([
      { op: 'set', table: 'use_case', key: 'EX-NOTE-UC01', changes: { title: 'Write a short note', goal: 'A writer keeps a thought.' } },
      { op: 'add', table: 'use_case_actor', row: { use_case_id: 'EX-NOTE-UC01', position: 1, role_name: 'Writer' } },
      { op: 'link', relation: 'follows', source: 'EX-NOTE-UC01', target: 'EX-PAT-NOTE' },
      { op: 'remove', table: 'use_case', key: 'EX-NOTE-UC02' },
      { op: 'add', table: 'use_case', row: { id: 'EX-NOTE-UC03', title: 'Share a note', capability_id: 'EX-NOTE-CAP01' } },
    ]);
    const after = tablesOf(store);
    const changes = recordChanges(store.schema, before, after);
    expect(changes.map((c) => [c.id, c.change])).toEqual([['EX-NOTE-UC01', 'changed'], ['EX-NOTE-UC02', 'removed'], ['EX-NOTE-UC03', 'added']]);
    const [changed, removed, added] = changes;
    expect(changed).toEqual({
      id: 'EX-NOTE-UC01', kind: 'use_case', title: 'Write a short note', change: 'changed',
      fields: [{ name: 'title', before: 'Write a note', after: 'Write a short note' }, { name: 'goal', after: 'A writer keeps a thought.' }],
      parts: [{ table: 'use_case_actor', key: 'use_case_id EX-NOTE-UC01, position 1', change: 'added', fields: [{ name: 'use_case_id', after: 'EX-NOTE-UC01' }, { name: 'position', after: 1 }, { name: 'role_name', after: 'Writer' }] }],
      links: { added: [{ relation: 'follows', target: 'EX-PAT-NOTE' }], removed: [] },
    });
    // An added or removed record is the whole record: none of its rows are listed.
    expect(removed).toMatchObject({ kind: 'use_case', title: 'Throw a note away', fields: [], parts: [], links: { added: [], removed: [] } });
    expect(added).toMatchObject({ kind: 'use_case', title: 'Share a note', fields: [], parts: [] });
    // Nothing changed, nothing listed; and the diff the other way round undoes it.
    expect(recordChanges(store.schema, after, after)).toEqual([]);
    expect(recordChanges(store.schema, after, before).map((c) => [c.id, c.change])).toEqual([['EX-NOTE-UC01', 'changed'], ['EX-NOTE-UC02', 'added'], ['EX-NOTE-UC03', 'removed']]);

    // A moment kept as a base and the rows that differed from it gives that moment's rows back.
    const delta = rowDelta(store.schema, before, after);
    expect(Object.keys(delta).sort()).toEqual(['follows', 'use_case', 'use_case_actor']);
    expect(recordChanges(store.schema, applyDelta(store.schema, before, delta), after)).toEqual([]);
  });
});
