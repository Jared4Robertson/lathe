// The command layer: add, set, move, link, unlink and remove, each one transaction that validates before it writes,
// and rewrites only the files of the tables it changed.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openStore, StoreError, type Command, type Store, type StoreProblem } from '../../src/index.ts';
import { everyKind, removeData, writeData } from './fixture.ts';

afterAll(removeData);

async function fresh(): Promise<{ store: Store; root: string }> {
  const root = writeData(everyKind());
  return { store: await openStore(root), root };
}

async function refused(store: Store, commands: Command[]): Promise<StoreProblem[]> {
  try {
    await store.apply(commands);
  } catch (error) {
    if (error instanceof StoreError) return error.problems;
    throw error;
  }
  throw new Error('The write went through, but it should have been refused.');
}

const files = (root: string) =>
  Object.fromEntries(readdirSync(path.join(root, 'data')).map((f) => [f, readFileSync(path.join(root, 'data', f), 'utf8')]));
const mtimes = (root: string) => Object.fromEntries(readdirSync(path.join(root, 'data')).map((f) => [f, statSync(path.join(root, 'data', f)).mtimeMs]));

describe('add', () => {
  it('adds a record, registers its ID and rewrites only its table file', async () => {
    const { store, root } = await fresh();
    const before = mtimes(root);
    const result = await store.add('requirement', { id: 'TL-LEND-UC01-R02', title: 'Member is known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' });
    expect(result).toEqual({ tables: ['requirement'], files: ['requirement.jsonl'] });
    expect(store.record('TL-LEND-UC01-R02')?.kind).toBe('requirement');
    expect(await store.query("SELECT kind FROM record_id WHERE id = 'TL-LEND-UC01-R02'")).toEqual([{ kind: 'requirement' }]);
    expect(await store.query("SELECT kind FROM obligation WHERE id = 'TL-LEND-UC01-R02'")).toEqual([{ kind: 'requirement' }]);
    const after = mtimes(root);
    expect(Object.keys(after).filter((f) => after[f] !== before[f])).toEqual(['requirement.jsonl']);
    expect(readFileSync(path.join(root, 'data', 'requirement.jsonl'), 'utf8').split('\n')[1]).toBe(
      '{"id":"TL-LEND-UC01-R02","title":"Member is known","use_case_id":"TL-LEND-UC01","statement":"The library MUST refuse an unknown member."}',
    );
    await store.close();
  });

  it('refuses a row whose key exists, a bad parent, and a link table', async () => {
    const { store } = await fresh();
    expect(await refused(store, [{ op: 'add', table: 'view', row: { id: 'TL-LEND-V01', title: 'Again', domain_id: 'TL-LEND' } }])).toEqual([
      expect.objectContaining({ rule: 'primary-key', command: 0 }),
    ]);
    expect(await refused(store, [{ op: 'add', table: 'view', row: { id: 'TL-LEND-V02', title: 'Desk', domain_id: 'TL-NOPE' } }])).toEqual([
      expect.objectContaining({ rule: 'foreign-key', command: 0, message: 'view TL-LEND-V02: domain_id "TL-NOPE" names no domain' }),
    ]);
    expect(await refused(store, [{ op: 'add', table: 'proves', row: { source_id: 'TL-LEND-T01', target_id: 'TL-LEND-DR01' } }])).toEqual([
      expect.objectContaining({ rule: 'command', message: expect.stringContaining('use link') }),
    ]);
    await store.close();
  });
});

describe('set', () => {
  it('changes and clears columns', async () => {
    const { store } = await fresh();
    await store.set('view', 'TL-LEND-V01', { title: 'Tool catalog', route: null, description: 'Every tool.' });
    expect(store.record('TL-LEND-V01')!.row).toEqual({ id: 'TL-LEND-V01', title: 'Tool catalog', domain_id: 'TL-LEND', description: 'Every tool.' });
    await store.set('entity_field', { entity_id: 'TL-LEND-EN01', position: 1 }, { example: '32' });
    expect(store.rows('entity_field')[0].example).toBe('32');
    await store.close();
  });

  it('refuses a key column, a parent column, an unknown column and a bad value', async () => {
    const { store } = await fresh();
    expect(await refused(store, [{ op: 'set', table: 'view', key: 'TL-LEND-V01', changes: { id: 'TL-LEND-V09' } }])).toEqual([expect.objectContaining({ rule: 'command' })]);
    expect(await refused(store, [{ op: 'set', table: 'view', key: 'TL-LEND-V01', changes: { domain_id: 'TL' } }])).toEqual([
      expect.objectContaining({ rule: 'command', message: expect.stringContaining('use move') }),
    ]);
    expect(await refused(store, [{ op: 'set', table: 'view', key: 'TL-LEND-V01', changes: { colour: 'red' } }])).toEqual([expect.objectContaining({ rule: 'column' })]);
    expect(await refused(store, [{ op: 'set', table: 'test', key: 'TL-LEND-T01', changes: { state: 'done' } }])).toEqual([expect.objectContaining({ rule: 'column' })]);
    expect(await refused(store, [{ op: 'set', table: 'test', key: 'TL-LEND-T01', changes: { title: null } }])).toEqual([expect.objectContaining({ rule: 'required' })]);
    expect(await refused(store, [{ op: 'set', table: 'view', key: 'TL-LEND-V77', changes: { title: 'x' } }])).toEqual([expect.objectContaining({ rule: 'missing' })]);
    await store.close();
  });
});

describe('move', () => {
  it('moves a record between parents of different kinds, setting and clearing its parent columns', async () => {
    const { store } = await fresh();
    await store.move('TL-LEND-UC01', 'TL-LEND');
    expect(store.record('TL-LEND-UC01')!.row.capability_id).toBeUndefined();
    await store.move('TL-LEND-DR02', 'TL-LEND-EN02');
    expect(store.record('TL-LEND-DR02')!.row).toMatchObject({ domain_id: 'TL-LEND', aggregate_id: 'TL-LEND-A1', entity_id: 'TL-LEND-EN02' });
    await store.move('TL-LEND-E01-R01', 'TL-LEND-API01');
    expect(store.record('TL-LEND-E01-R01')!.row).toMatchObject({ domain_id: 'TL-LEND', api_id: 'TL-LEND-API01' });
    expect(store.record('TL-LEND-E01-R01')!.row.endpoint_id).toBeUndefined();
    await store.close();
  });

  it('carries what sits inside along to another domain', async () => {
    const { store } = await fresh();
    await store.add('domain', { id: 'TL-CAT', title: 'Catalog', product_id: 'TL' });
    // The capability holds a use case, a flow and a test, whose own domain_id must follow it.
    const result = await store.apply([
      { op: 'unlink', relation: 'involves', source: 'TL-LEND-DR02', target: 'TL-LEND-A1' },
      { op: 'move', id: 'TL-LEND-CAP01', parent: 'TL-CAT' },
    ]);
    expect(result.tables).toEqual(['capability', 'flow', 'involves', 'test', 'use_case']);
    for (const id of ['TL-LEND-CAP01', 'TL-LEND-UC01', 'TL-LEND-F01', 'TL-LEND-T01']) expect(store.record(id)!.row.domain_id).toBe('TL-CAT');
    expect(await store.query("SELECT domain_id FROM record_scope WHERE id = 'TL-LEND-UC01-R01'")).toEqual([{ domain_id: 'TL-CAT' }]);
    await store.close();
  });

  it('refuses a parent its kind cannot sit under, and a move inside itself', async () => {
    const { store } = await fresh();
    expect(await refused(store, [{ op: 'move', id: 'TL-LEND-UC01', parent: 'TL-LEND-A1' }])).toEqual([
      expect.objectContaining({ rule: 'parent', message: 'a use_case sits under capability or domain, not under aggregate TL-LEND-A1' }),
    ]);
    expect(await refused(store, [{ op: 'move', id: 'TL-LEND-LAY02', parent: 'TL-LEND-LAY01' }])).toEqual([expect.objectContaining({ rule: 'command' })]);
    await store.close();
  });
});

describe('link and unlink', () => {
  it('links and unlinks, keeping the file sorted by its key columns', async () => {
    const { store, root } = await fresh();
    await store.link('proves', 'TL-LEND-T01', 'TL-LEND-DR01');
    expect(readFileSync(path.join(root, 'data', 'proves.jsonl'), 'utf8')).toBe(
      ['TL-LEND-DR01', 'TL-LEND-INV01', 'TL-LEND-UC01-R01'].map((t) => `{"source_id":"TL-LEND-T01","target_id":"${t}"}\n`).join(''),
    );
    await store.unlink('proves', 'TL-LEND-T01', 'TL-LEND-DR01');
    expect(store.rows('proves')).toHaveLength(2);
    expect(await refused(store, [{ op: 'unlink', relation: 'proves', source: 'TL-LEND-T01', target: 'TL-LEND-DR01' }])).toEqual([expect.objectContaining({ rule: 'missing' })]);
    await store.close();
  });

  it('refuses a link its supertype ends allow but its relation does not', async () => {
    const { store } = await fresh();
    // A view is a fulfills source and a domain rule an obligation, but a view carries out only requirements.
    expect(await refused(store, [{ op: 'link', relation: 'fulfills', source: 'TL-LEND-V01', target: 'TL-LEND-DR01' }])).toEqual([
      expect.objectContaining({ rule: 'relation-pair', command: 0, message: expect.stringContaining('TL-LEND-V01 (a view) cannot fulfills TL-LEND-DR01 (a domain_rule)') }),
    ]);
    expect(await refused(store, [{ op: 'link', relation: 'proves', source: 'TL-LEND-T01', target: 'TL-LEND-UC01' }])).toEqual([
      expect.objectContaining({ rule: 'foreign-key', message: expect.stringContaining('names no obligation') }),
    ]);
    expect(await refused(store, [{ op: 'link', relation: 'teaches', source: 'TL-LEND-T01', target: 'TL-LEND-UC01' }])).toEqual([expect.objectContaining({ rule: 'unknown-relation' })]);
    await store.close();
  });

  it('refuses a link to another product', async () => {
    const { store } = await fresh();
    const problems = await refused(store, [
      { op: 'add', table: 'product', row: { id: 'LA', title: 'Lathe' } },
      { op: 'add', table: 'domain', row: { id: 'LA-AUT', title: 'Authoring', product_id: 'LA' } },
      { op: 'add', table: 'aggregate', row: { id: 'LA-AUT-A1', title: 'Record', domain_id: 'LA-AUT' } },
      { op: 'link', relation: 'relates_to', source: 'TL-LEND-A1', target: 'LA-AUT-A1' },
    ]);
    expect(problems).toEqual([expect.objectContaining({ rule: 'link-crosses-product', command: 3 })]);
    await store.close();
  });
});

describe('remove', () => {
  it('refuses a record others reference, saying what references it', async () => {
    const { store } = await fresh();
    const problems = await refused(store, [{ op: 'remove', table: 'requirement', key: 'TL-LEND-UC01-R01' }]);
    expect(problems).toEqual([expect.objectContaining({ rule: 'referenced' })]);
    for (const line of ['TL-LEND-F01 carries out TL-LEND-UC01-R01', 'TL-LEND-C01 satisfies TL-LEND-UC01-R01', 'TL-LEND-T01 proves TL-LEND-UC01-R01']) {
      expect(problems[0].message).toContain(line);
    }
    expect(await refused(store, [{ op: 'remove', table: 'pattern_setting', key: { pattern_id: 'TL-PAT-ACT', position: 1 } }])).toEqual([
      expect.objectContaining({ rule: 'referenced', message: expect.stringContaining('pattern_rule TL-PAT-ACT-R01 (pattern_id, setting)') }),
    ]);
    await store.close();
  });

  it('removes a record with its parts and the links it starts', async () => {
    const { store, root } = await fresh();
    // The rule's involves link is its own, so it goes with it.
    await store.remove('domain_rule', 'TL-LEND-DR02');
    expect(store.record('TL-LEND-DR02')).toBeUndefined();
    expect(store.rows('involves')).toEqual([]);
    expect(readdirSync(path.join(root, 'data'))).not.toContain('involves.jsonl');
    // A use case goes with its actors, steps, setting values and its own links, once nothing points at it.
    const links = ['fulfills', 'satisfies', 'proves', 'supports'] as const;
    await store.apply([
      ...links.map((relation) => ({ op: 'unlink' as const, relation, source: relation === 'fulfills' ? 'TL-LEND-F01' : relation === 'satisfies' ? 'TL-LEND-C01' : 'TL-LEND-T01', target: relation === 'supports' ? 'TL-LEND-DR01' : 'TL-LEND-UC01-R01' })),
      { op: 'remove', table: 'requirement', key: 'TL-LEND-UC01-R01' },
      { op: 'unlink', relation: 'about', source: 'TL-LEND-Q01', target: 'TL-LEND-UC01' },
      { op: 'unlink', relation: 'carries_out', source: 'TL-LEND-F01', target: 'TL-LEND-UC01' },
      { op: 'remove', table: 'use_case', key: 'TL-LEND-UC01' },
    ]);
    for (const table of ['use_case', 'use_case_actor', 'use_case_step', 'setting_value', 'follows']) expect(store.rows(table)).toEqual([]);
    await store.close();
  });
});

describe('a write', () => {
  it('is all or nothing: a refused command leaves the data and the files as they were', async () => {
    const { store, root } = await fresh();
    const before = files(root);
    const problems = await refused(store, [
      { op: 'add', table: 'view', row: { id: 'TL-LEND-V02', title: 'Desk', domain_id: 'TL-LEND' } },
      { op: 'link', relation: 'uses', source: 'TL-LEND-V02', target: 'TL-LEND-E01' },
      { op: 'add', table: 'test', row: { id: 'TL-LEND-T02', title: 'Broken', domain_id: 'TL-LEND', test_type: 'unit', state: 'automated' } },
    ]);
    expect(problems).toEqual([expect.objectContaining({ rule: 'check', command: 2 })]);
    expect(store.record('TL-LEND-V02')).toBeUndefined();
    expect(await store.query("SELECT id FROM view WHERE id = 'TL-LEND-V02'")).toEqual([]);
    expect(files(root)).toEqual(before);
    await store.close();
  });

  it('declares a product kind and adds its records in one write', async () => {
    const { store, root } = await fresh();
    await store.apply([
      { op: 'add', table: 'product_kind', row: { name: 'report', product_id: 'TL', label: 'Report', description: 'A report the library prints.', parent_kind: 'domain', obligation: 'none' } },
      { op: 'add', table: 'product_kind_field', row: { kind: 'report', position: 1, name: 'printed_on', type: 'date', required: false, description: 'When it was printed.' } },
      { op: 'add', table: 'report', row: { id: 'TL-LEND-REP01', title: 'Overdue loans', domain_id: 'TL-LEND', printed_on: '2026-03-02' } },
    ]);
    expect(store.schema.kinds.report).toMatchObject({ productId: 'TL', parents: [{ kind: 'domain', column: 'domain_id' }] });
    expect(readFileSync(path.join(root, 'data', 'report.jsonl'), 'utf8')).toBe('{"id":"TL-LEND-REP01","title":"Overdue loans","domain_id":"TL-LEND","printed_on":"2026-03-02"}\n');
    expect(await refused(store, [{ op: 'add', table: 'report', row: { id: 'TL-LEND-REP02', title: 'x', domain_id: 'TL-LEND', printed_on: '2026-02-30' } }])).toEqual([
      expect.objectContaining({ rule: 'column' }),
    ]);
    expect(await refused(store, [{ op: 'add', table: 'product_kind', row: { name: 'view', product_id: 'TL', label: 'View', description: 'Again.', parent_kind: 'domain', obligation: 'none' } }])).toEqual([
      expect.objectContaining({ rule: 'product-kind', message: expect.stringContaining('a table Lathe already has') }),
    ]);
    // The product's own obligation can be proved, and its own relation links to it.
    expect(await store.query("SELECT source_id FROM proves WHERE target_id = 'TL-LEND-INV01'")).toEqual([{ source_id: 'TL-LEND-T01' }]);
    expect(await refused(store, [{ op: 'link', relation: 'enforces', source: 'TL-LEND-T01', target: 'TL-LEND-INV01' }])).toEqual([expect.objectContaining({ rule: 'foreign-key' })]);
    await store.close();
    const reopened = await openStore(root);
    expect(reopened.record('TL-LEND-REP01')?.kind).toBe('report');
    await reopened.close();
  });

  it('refuses an aggregate with two roots', async () => {
    const { store } = await fresh();
    expect(await refused(store, [{ op: 'set', table: 'entity', key: 'TL-LEND-EN02', changes: { role: 'root' } }])).toEqual([
      expect.objectContaining({ rule: 'aggregate-root', table: 'aggregate', key: 'TL-LEND-A1' }),
    ]);
    await store.close();
  });

  it('runs writes one after another, each on the state the one before left', async () => {
    const { store } = await fresh();
    await Promise.all(
      [2, 3, 4].map((n) => store.add('view', { id: `TL-LEND-V0${n}`, title: `View ${n}`, domain_id: 'TL-LEND' })),
    );
    expect(store.rows('view').map((v) => v.id)).toEqual(['TL-LEND-V01', 'TL-LEND-V02', 'TL-LEND-V03', 'TL-LEND-V04']);
    const reader = await store.connect();
    expect((await reader.runAndReadAll('SELECT count(*)::INTEGER AS n FROM view')).getRowObjectsJson()).toEqual([{ n: 4 }]);
    reader.closeSync();
    await store.close();
  });
});
