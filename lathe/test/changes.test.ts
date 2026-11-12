// The one record diff (LA-EXP-QRY13, lathe/src/changes.ts): what changed between two versions of a product's rows, by
// record, against a store made here, so the rows are the ones the aggregates' commands write.
import { rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configuredRoot } from './store/fixture.ts';
import { applyDelta, recordChanges, rowDelta, type Tables } from '../src/changes.ts';
import { openStore, type Store } from '../src/platform/data/index.ts';
import { run } from './helpers.ts';

let root = '';
let store: Store;

/** Every stored table's rows, as the store holds them now. */
const tablesOf = (s: Store): Tables => Object.fromEntries(Object.entries(s.schema.tables).filter(([, t]) => t.stored).map(([name]) => [name, s.rows(name)]));

beforeAll(async () => {
  root = configuredRoot('lathe-changes-');
  store = await openStore(root);
  await run(store, 'product add-product', { id: 'EX', title: 'Example', description: 'A small product for writing notes.', roles: [{ name: 'Writer', description: 'Someone who writes notes.' }] });
  await run(store, 'domain add-domain', { id: 'EX-NOTE', title: 'Notes', product_id: 'EX', position: 2, subdomain_type: 'core', description: 'Writing and keeping notes.' });
  await run(store, 'domain add-capability', { id: 'EX-NOTE-CAP01', title: 'Writing', domain_id: 'EX-NOTE', position: 1, description: 'Writing notes down.' });
  await run(store, 'aggregate add-aggregate', { id: 'EX-NOTE-A1', title: 'Note', domain_id: 'EX-NOTE', identity: 'Note ID', description: 'One note a writer keeps.' });
  await run(store, 'aggregate add-entity', { id: 'EX-NOTE-EN01', title: 'Note', aggregate_id: 'EX-NOTE-A1', role: 'root', description: 'The note itself.' });
  await run(store, 'command add-command', { id: 'EX-NOTE-CMD01', title: 'Write a note', entity_id: 'EX-NOTE-EN01', description: 'Keeps a new note.' });
  await run(store, 'command add-command', { id: 'EX-NOTE-CMD02', title: 'Throw a note away', entity_id: 'EX-NOTE-EN01', description: 'Drops a note.' });
  await run(store, 'command add-command', { id: 'EX-NOTE-CMD03', title: 'Share a note', entity_id: 'EX-NOTE-EN01', description: 'Lets someone else read a note.' });
  await run(store, 'pattern add-pattern', { id: 'EX-PAT-NOTE', title: 'A note action', product_id: 'EX', description: 'An action on one note.' });
  await run(store, 'use-case add-use-case', { id: 'EX-NOTE-UC01', title: 'Write a note', capability_id: 'EX-NOTE-CAP01', goal: 'A writer keeps a thought.', result_id: 'EX-NOTE-CMD01' });
  await run(store, 'use-case add-use-case', { id: 'EX-NOTE-UC02', title: 'Throw a note away', capability_id: 'EX-NOTE-CAP01', goal: 'A writer drops a note they no longer need.', result_id: 'EX-NOTE-CMD02' });
}, 60_000);

afterAll(async () => {
  await store?.close();
  rmSync(root, { recursive: true, force: true });
});

describe('the record diff', () => {
  it('LA-EXP-UC15-R01-T01 One definition of what changed: records added, removed and changed field by field, their part rows, and the links they start', async () => {
    const before = tablesOf(store);
    await run(store, 'use-case change-use-case', { id: 'EX-NOTE-UC01', title: 'Write a short note', goal: 'A writer keeps a short thought.', actors: ['Writer'] });
    await run(store, 'pattern-following follow-pattern', { follower_id: 'EX-NOTE-UC01', pattern_id: 'EX-PAT-NOTE' });
    await run(store, 'use-case remove-use-case', { id: 'EX-NOTE-UC02' });
    await run(store, 'use-case add-use-case', { id: 'EX-NOTE-UC03', title: 'Share a note', capability_id: 'EX-NOTE-CAP01', goal: 'A writer lets someone else read a note.', result_id: 'EX-NOTE-CMD03' });
    const after = tablesOf(store);
    const changes = recordChanges(store.schema, before, after);
    expect(changes.map((c) => [c.id, c.change])).toEqual([['EX-NOTE-UC01', 'changed'], ['EX-NOTE-UC02', 'removed'], ['EX-NOTE-UC03', 'added']]);
    const [changed, removed, added] = changes;
    expect(changed).toEqual({
      id: 'EX-NOTE-UC01', kind: 'use_case', title: 'Write a short note', change: 'changed',
      fields: [{ name: 'title', before: 'Write a note', after: 'Write a short note' }, { name: 'goal', before: 'A writer keeps a thought.', after: 'A writer keeps a short thought.' }],
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
