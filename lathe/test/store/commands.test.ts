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
  it('LA-AUT-INV35-T adds a record, registers its ID and supertypes, and rewrites only its table file', async () => {
    const { store, root } = await fresh();
    const before = mtimes(root);
    const result = await store.add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'Member is known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' });
    expect(result).toEqual({ tables: ['uc_requirement'], files: ['uc_requirement.jsonl'] });
    expect(store.record('TL-LEND-UC01-R02')?.kind).toBe('uc_requirement');
    expect(await store.query("SELECT kind FROM record_id WHERE id = 'TL-LEND-UC01-R02'")).toEqual([{ kind: 'uc_requirement' }]);
    expect(await store.query("SELECT kind FROM obligation WHERE id = 'TL-LEND-UC01-R02'")).toEqual([{ kind: 'uc_requirement' }]);
    const after = mtimes(root);
    expect(Object.keys(after).filter((f) => after[f] !== before[f])).toEqual(['uc_requirement.jsonl']);
    expect(readFileSync(path.join(root, 'data', 'uc_requirement.jsonl'), 'utf8').split('\n')[1]).toBe(
      '{"id":"TL-LEND-UC01-R02","title":"Member is known","use_case_id":"TL-LEND-UC01","statement":"The library MUST refuse an unknown member."}',
    );
    await store.close();
  });

  it('adds a record of each new kind: one with no owner, one under either of two parents, and a test', async () => {
    const { store } = await fresh();
    await store.apply([
      { op: 'add', table: 'specification', row: { id: 'TL-LEND-SP02', title: 'Member in good standing', statement: 'A member owes nothing.' } },
      { op: 'link', relation: 'reads', source: 'TL-LEND-SP02', target: 'TL-LEND-A1' },
      { op: 'add', table: 'endpoint', row: { id: 'TL-LEND-EP02', title: 'Free tools', query_id: 'TL-LEND-QRY01', method: 'GET', route: '/tools/free' } },
      { op: 'add', table: 'specification_test', row: { id: 'TL-LEND-SP02-T', title: 'Good standing', specification_id: 'TL-LEND-SP02', level: 'unit', state: 'manual', manual_reason: 'Not yet coded.' } },
    ]);
    expect(await store.query("SELECT * FROM record_scope WHERE id IN ('TL-LEND-SP02', 'TL-LEND-EP02', 'TL-LEND-SP02-T') ORDER BY id")).toEqual([
      { id: 'TL-LEND-EP02', product_id: 'TL', domain_id: 'TL-LEND', aggregate_id: null },
      { id: 'TL-LEND-SP02', product_id: 'TL', domain_id: 'TL-LEND', aggregate_id: null },
      { id: 'TL-LEND-SP02-T', product_id: 'TL', domain_id: 'TL-LEND', aggregate_id: null },
    ]);
    expect(await store.query("SELECT parent_id FROM record_parent WHERE id = 'TL-LEND-EP02'")).toEqual([{ parent_id: 'TL-LEND-QRY01' }]);
    await store.close();
  });

  it('LA-AUT-INV37-T refuses a row whose key exists, a bad parent, and a link table', async () => {
    const { store } = await fresh();
    expect(await refused(store, [{ op: 'add', table: 'view', row: { id: 'TL-V01', title: 'Again' } }])).toEqual([expect.objectContaining({ rule: 'primary-key', command: 0 })]);
    expect(await refused(store, [{ op: 'add', table: 'view_requirement', row: { id: 'TL-V09-R01', title: 'Lost', view_id: 'TL-V09', statement: 'x' } }])).toEqual([
      expect.objectContaining({ rule: 'foreign-key', command: 0, message: 'view_requirement TL-V09-R01: view_id "TL-V09" names no view' }),
    ]);
    expect(await refused(store, [{ op: 'add', table: 'reads', row: { source_id: 'TL-LEND-SP01', target_id: 'TL-LEND-A1' } }])).toEqual([
      expect.objectContaining({ rule: 'command', message: expect.stringContaining('use link') }),
    ]);
    await store.close();
  });
});

describe('record_scope', () => {
  it('LA-PLT-UC01-R05-T01 a record with no owner belongs to the one domain that uses it, with what sits under it, and is shared when two or none do', async () => {
    const { store } = await fresh();
    const domains = async (ids: string[]) =>
      Object.fromEntries(
        (await store.query<{ id: string; domain_id: string | null }>(`SELECT id, domain_id FROM record_scope WHERE id IN (${ids.map((id) => `'${id}'`).join(', ')})`)).map((r) => [r.id, r.domain_id]),
      );
    // Lending's one flow step happens in the view and exchanges with the integration, the view's UI component renders
    // it, and a Lending entity's field is typed by the value object: all four, and what sits under them, are Lending's.
    const lending = ['TL-V01', 'TL-V01-R01', 'TL-V01-R01-T01', 'TL-INT01', 'TL-INT01-AD', 'TL-INT01-T01', 'TL-UI01', 'TL-VO01', 'TL-VO01-C01', 'TL-VO01-C01-T', 'TL-VO01-VT'];
    expect(await domains(lending)).toEqual(Object.fromEntries(lending.map((id) => [id, 'TL-LEND'])));
    // A second domain's flow step happens in the same view, and its read model has a field typed by a new value
    // object; a third value object is used by no one.
    await store.apply([
      { op: 'add', table: 'domain', row: { id: 'TL-CAT', title: 'Catalog', product_id: 'TL', subdomain_type: 'supporting' } },
      { op: 'add', table: 'capability', row: { id: 'TL-CAT-CAP01', title: 'Browsing', domain_id: 'TL-CAT', position: 1 } },
      { op: 'add', table: 'use_case', row: { id: 'TL-CAT-UC01', title: 'Browse the tools', capability_id: 'TL-CAT-CAP01' } },
      { op: 'add', table: 'flow', row: { id: 'TL-CAT-UC01-FL', title: 'Browse', use_case_id: 'TL-CAT-UC01' } },
      { op: 'add', table: 'flow_step', row: { id: 'TL-CAT-UC01-FL-S01', title: 'Open the catalog', flow_id: 'TL-CAT-UC01-FL', path: 'main', position: 1 } },
      { op: 'link', relation: 'happens_in', source: 'TL-CAT-UC01-FL-S01', target: 'TL-V01' },
      { op: 'add', table: 'value_object', row: { id: 'TL-VO02', title: 'Tool size' } },
      { op: 'add', table: 'value_object', row: { id: 'TL-VO03', title: 'Postcode' } },
      { op: 'add', table: 'read_model', row: { id: 'TL-CAT-RM01', title: 'Tools by size', domain_id: 'TL-CAT' } },
      { op: 'add', table: 'read_model_field', row: { read_model_id: 'TL-CAT-RM01', position: 1, name: 'Size', meaning: 'How big the tool is.', type_value_object_id: 'TL-VO02', required: true } },
    ]);
    expect(await domains([...lending, 'TL-VO02', 'TL-VO03'])).toEqual({
      'TL-V01': null,
      'TL-V01-R01': null,
      'TL-V01-R01-T01': null,
      'TL-UI01': null,
      'TL-INT01': 'TL-LEND',
      'TL-INT01-AD': 'TL-LEND',
      'TL-INT01-T01': 'TL-LEND',
      'TL-VO01': 'TL-LEND',
      'TL-VO01-C01': 'TL-LEND',
      'TL-VO01-C01-T': 'TL-LEND',
      'TL-VO01-VT': 'TL-LEND',
      'TL-VO02': 'TL-CAT',
      'TL-VO03': null,
    });
    // IDs stay product-scoped, so moving to shared needed no rename; the product stays.
    expect(await store.query("SELECT product_id FROM record_scope WHERE id = 'TL-V01'")).toEqual([{ product_id: 'TL' }]);
    await store.close();
  });
});

describe('set', () => {
  it('LA-AUT-INV38-T changes and clears columns', async () => {
    const { store } = await fresh();
    await store.set('view', 'TL-V01', { title: 'Tool catalog', route: null, description: 'Every tool.' });
    expect(store.record('TL-V01')!.row).toEqual({ id: 'TL-V01', title: 'Tool catalog', description: 'Every tool.' });
    await store.set('entity_field', { entity_id: 'TL-LEND-EN01', position: 1 }, { example: '32' });
    expect(store.rows('entity_field')[0].example).toBe('32');
    await store.set('table_key', { table_id: 'TL-LEND-EN01-TB', position: 2 }, { condition: null });
    expect(store.rows('table_key')[1].condition).toBeUndefined();
    await store.close();
  });

  it('refuses a key column, a parent column, an unknown column and a bad value', async () => {
    const { store } = await fresh();
    expect(await refused(store, [{ op: 'set', table: 'view', key: 'TL-V01', changes: { id: 'TL-V09' } }])).toEqual([expect.objectContaining({ rule: 'command' })]);
    expect(await refused(store, [{ op: 'set', table: 'endpoint', key: 'TL-LEND-EP01', changes: { query_id: 'TL-LEND-QRY01' } }])).toEqual([
      expect.objectContaining({ rule: 'command', message: expect.stringContaining('use move') }),
    ]);
    expect(await refused(store, [{ op: 'set', table: 'view', key: 'TL-V01', changes: { colour: 'red' } }])).toEqual([expect.objectContaining({ rule: 'column' })]);
    expect(await refused(store, [{ op: 'set', table: 'invariant_test', key: 'TL-LEND-INV01-T', changes: { state: 'done' } }])).toEqual([expect.objectContaining({ rule: 'column' })]);
    expect(await refused(store, [{ op: 'set', table: 'invariant_test', key: 'TL-LEND-INV01-T', changes: { title: null } }])).toEqual([expect.objectContaining({ rule: 'required' })]);
    expect(await refused(store, [{ op: 'set', table: 'view', key: 'TL-V77', changes: { title: 'x' } }])).toEqual([expect.objectContaining({ rule: 'missing' })]);
    await store.close();
  });
});

describe('move', () => {
  it('moves a record between its two parent kinds, setting one parent column and clearing the other', async () => {
    const { store } = await fresh();
    await store.move('TL-LEND-EP01', 'TL-LEND-QRY01');
    expect(store.record('TL-LEND-EP01')!.row).toMatchObject({ query_id: 'TL-LEND-QRY01' });
    expect(store.record('TL-LEND-EP01')!.row.command_id).toBeUndefined();
    await store.move('TL-LEND-Q01', 'TL');
    expect(store.record('TL-LEND-Q01')!.row).toMatchObject({ product_id: 'TL' });
    expect(store.record('TL-LEND-Q01')!.row.domain_id).toBeUndefined();
    await store.close();
  });

  it('moves a record to another parent of its kind, keeping what sits inside it', async () => {
    const { store } = await fresh();
    await store.add('capability', { id: 'TL-LEND-CAP02', title: 'Returns', domain_id: 'TL-LEND', position: 2 });
    const result = await store.move('TL-LEND-UC01', 'TL-LEND-CAP02');
    expect(result.tables).toEqual(['use_case']);
    expect(await store.query("SELECT parent_id FROM record_parent WHERE id = 'TL-LEND-UC01-FL'")).toEqual([{ parent_id: 'TL-LEND-UC01' }]);
    await store.close();
  });

  it('LA-AUT-SP01-T refuses to move a record with no owner', async () => {
    const { store } = await fresh();
    expect(await refused(store, [{ op: 'move', id: 'TL-V01', parent: 'TL' }])).toEqual([expect.objectContaining({ rule: 'command', message: 'a view has no parent, so it cannot move' })]);
    await store.close();
  });

  it("refuses a parent its kind cannot sit under, and a move that leaves an ID outside its domain", async () => {
    const { store } = await fresh();
    expect(await refused(store, [{ op: 'move', id: 'TL-LEND-UC01', parent: 'TL-LEND-A1' }])).toEqual([
      expect.objectContaining({ rule: 'parent', message: 'a use_case sits under capability, not under aggregate TL-LEND-A1' }),
    ]);
    const problems = await refused(store, [
      { op: 'add', table: 'domain', row: { id: 'TL-CAT', title: 'Catalog', product_id: 'TL', subdomain_type: 'generic' } },
      { op: 'add', table: 'capability', row: { id: 'TL-CAT-CAP01', title: 'Listing', domain_id: 'TL-CAT', position: 1 } },
      { op: 'move', id: 'TL-LEND-UC01', parent: 'TL-CAT-CAP01' },
    ]);
    expect(problems).toEqual([expect.objectContaining({ rule: 'id-prefix', command: 2, key: 'TL-LEND-UC01', message: 'TL-LEND-UC01 is a Use case in domain TL-CAT, so its ID starts with TL-CAT-' })]);
    await store.close();
  });
});

describe('link and unlink', () => {
  it('links and unlinks, keeping the file sorted by its key columns', async () => {
    const { store, root } = await fresh();
    await store.link('calls', 'TL-LEND-QRY01', 'TL-LEND-DS01');
    expect(readFileSync(path.join(root, 'data', 'calls.jsonl'), 'utf8')).toBe(
      ['TL-LEND-CMD01', 'TL-LEND-QRY01'].map((s) => `{"source_id":"${s}","target_id":"TL-LEND-DS01"}\n`).join(''),
    );
    await store.unlink('calls', 'TL-LEND-QRY01', 'TL-LEND-DS01');
    expect(store.rows('calls')).toHaveLength(1);
    expect(await refused(store, [{ op: 'unlink', relation: 'calls', source: 'TL-LEND-QRY01', target: 'TL-LEND-DS01' }])).toEqual([expect.objectContaining({ rule: 'missing' })]);
    await store.close();
  });

  it('LA-AUT-SP07-T refuses a link its ends allow but its relation does not, a wrong kind at an end, and an unknown relation', async () => {
    const { store } = await fresh();
    // A second pair widens documents to a link table whose target is any record, so its pairs are what hold.
    await store.add('product_relation', { name: 'documents', source_kind: 'cli_command', target_kind: 'integration', product_id: 'TL', forward_label: 'Documents', reverse_label: 'Documented by', description: 'The CLI command is documented with the integration.' });
    expect(store.schema.relations.documents.targetTable).toBe('record_id');
    expect(await refused(store, [{ op: 'link', relation: 'documents', source: 'TL-LEND-CMD01-CLI', target: 'TL-LEND-UC01-R01' }])).toEqual([
      expect.objectContaining({ rule: 'relation-pair', command: 0, message: expect.stringContaining('TL-LEND-CMD01-CLI (a cli_command) cannot documents TL-LEND-UC01-R01 (a uc_requirement)') }),
    ]);
    expect(await refused(store, [{ op: 'link', relation: 'calls', source: 'TL-LEND-QRY01', target: 'TL-LEND-UC01' }])).toEqual([
      expect.objectContaining({ rule: 'foreign-key', message: expect.stringContaining('names no domain_service') }),
    ]);
    expect(await refused(store, [{ op: 'link', relation: 'calls', source: 'TL-LEND-UC01', target: 'TL-LEND-DS01' }])).toEqual([
      expect.objectContaining({ rule: 'foreign-key', message: expect.stringContaining('names no calls_source (command, query, read_model)') }),
    ]);
    expect(await refused(store, [{ op: 'link', relation: 'teaches', source: 'TL-LEND-UC01', target: 'TL-LEND-UC01' }])).toEqual([expect.objectContaining({ rule: 'unknown-relation' })]);
    await store.close();
  });

  it('refuses a link to another product', async () => {
    const { store } = await fresh();
    const problems = await refused(store, [
      { op: 'add', table: 'product', row: { id: 'LA', title: 'Lathe' } },
      { op: 'add', table: 'domain', row: { id: 'LA-AUT', title: 'Authoring', product_id: 'LA', subdomain_type: 'core' } },
      { op: 'add', table: 'aggregate', row: { id: 'LA-AUT-A1', title: 'Record', domain_id: 'LA-AUT' } },
      { op: 'link', relation: 'reads', source: 'TL-LEND-RM01', target: 'LA-AUT-A1' },
    ]);
    expect(problems).toEqual([expect.objectContaining({ rule: 'link-crosses-product', command: 3 })]);
    await store.close();
  });
});

describe('remove', () => {
  it('LA-AUT-SP02-T refuses a record others reference, saying what references it', async () => {
    const { store } = await fresh();
    const problems = await refused(store, [{ op: 'remove', table: 'uc_requirement', key: 'TL-LEND-UC01-R01' }]);
    expect(problems).toEqual([expect.objectContaining({ rule: 'referenced' })]);
    for (const line of ['TL-LEND-UC01-FL-S01 fulfills TL-LEND-UC01-R01', 'use_case_test TL-LEND-UC01-R01-T01 (uc_requirement_id)']) {
      expect(problems[0].message).toContain(line);
    }
    expect(await refused(store, [{ op: 'remove', table: 'pattern_setting', key: { pattern_id: 'TL-PAT-ACT', position: 1 } }])).toEqual([
      expect.objectContaining({ rule: 'referenced', message: expect.stringContaining('pattern_rule TL-PAT-ACT-R01 (pattern_id, setting)') }),
    ]);
    expect(await refused(store, [{ op: 'remove', table: 'value_object', key: 'TL-VO01' }])).toEqual([
      expect.objectContaining({ rule: 'referenced', message: expect.stringContaining('entity_field entity_id TL-LEND-EN01, position 2 (type_value_object_id)') }),
    ]);
    await store.close();
  });

  it('LA-AUT-INV39-T removes a record with its parts and the links it starts', async () => {
    const { store, root } = await fresh();
    // The step's links are its own, so they go with it.
    await store.remove('flow_step', 'TL-LEND-UC01-FL-S01');
    for (const table of ['fulfills', 'invokes', 'happens_in', 'exchanges_with']) {
      expect(store.rows(table)).toEqual([]);
      expect(readdirSync(path.join(root, 'data'))).not.toContain(`${table}.jsonl`);
    }
    // A use case goes with its actors, setting values and its own links, once nothing points at it.
    await store.apply([
      { op: 'remove', table: 'flow_test', key: 'TL-LEND-UC01-FL-T' },
      { op: 'remove', table: 'flow', key: 'TL-LEND-UC01-FL' },
      { op: 'remove', table: 'use_case_test', key: 'TL-LEND-UC01-R01-T01' },
      { op: 'remove', table: 'uc_requirement', key: 'TL-LEND-UC01-R01' },
      { op: 'unlink', relation: 'about', source: 'TL-LEND-Q01', target: 'TL-LEND-UC01' },
      { op: 'remove', table: 'use_case', key: 'TL-LEND-UC01' },
    ]);
    for (const table of ['use_case', 'use_case_actor', 'setting_value', 'follows']) expect(store.rows(table)).toEqual([]);
    // A table goes with its keys.
    await store.remove('table', 'TL-LEND-RM01-TB');
    expect(store.rows('table_key').map((k) => k.table_id)).toEqual(['TL-LEND-EN01-TB', 'TL-LEND-EN01-TB']);
    await store.close();
  });
});

describe('a write', () => {
  describe('LA-STD-PRINCIPLES-R01-T02 a refused write changes nothing', () => {
    it('LA-AUT-INV33-T is all or nothing: a refused command leaves the data and the files as they were', async () => {
      const { store, root } = await fresh();
      const before = files(root);
      const problems = await refused(store, [
        { op: 'add', table: 'view', row: { id: 'TL-V02', title: 'Desk' } },
        { op: 'link', relation: 'renders', source: 'TL-UI01', target: 'TL-V02' },
        { op: 'add', table: 'domain_service_test', row: { id: 'TL-LEND-DS01-T02', title: 'Broken', domain_service_id: 'TL-LEND-DS01', level: 'unit', state: 'automated' } },
      ]);
      expect(problems).toEqual([expect.objectContaining({ rule: 'check', command: 2 })]);
      expect(store.record('TL-V02')).toBeUndefined();
      expect(await store.query("SELECT id FROM view WHERE id = 'TL-V02'")).toEqual([]);
      expect(files(root)).toEqual(before);
      await store.close();
    });
  });

  it('declares a product kind in any stage and adds its records in one write', async () => {
    const { store, root } = await fresh();
    await store.apply([
      { op: 'add', table: 'product_kind', row: { name: 'report', product_id: 'TL', label: 'Report', description: 'A report the library prints.', parent_kind: 'read_model', stage: 'interaction-design', obligation: true, id_pattern: '<read model>-REP<nn>' } },
      { op: 'add', table: 'product_kind_field', row: { kind: 'report', position: 1, name: 'printed_on', type: 'date', required: false, description: 'When it was printed.' } },
      { op: 'add', table: 'report', row: { id: 'TL-LEND-RM01-REP01', title: 'Overdue loans', read_model_id: 'TL-LEND-RM01', printed_on: '2026-03-02' } },
    ]);
    expect(store.schema.kinds.report).toMatchObject({ productId: 'TL', stage: 'interaction-design', obligation: true, idScope: null, parents: [{ kind: 'read_model', column: 'read_model_id' }] });
    expect(store.schema.supertypes.obligation).toContain('report');
    expect(readFileSync(path.join(root, 'data', 'report.jsonl'), 'utf8')).toBe('{"id":"TL-LEND-RM01-REP01","title":"Overdue loans","read_model_id":"TL-LEND-RM01","printed_on":"2026-03-02"}\n');
    expect(await refused(store, [{ op: 'add', table: 'report', row: { id: 'TL-LEND-RM01-REP02', title: 'x', read_model_id: 'TL-LEND-RM01', printed_on: '2026-02-30' } }])).toEqual([
      expect.objectContaining({ rule: 'column' }),
    ]);
    expect(await refused(store, [{ op: 'add', table: 'product_kind', row: { name: 'view', product_id: 'TL', label: 'View', description: 'Again.', parent_kind: 'domain', obligation: false } }])).toEqual([
      expect.objectContaining({ rule: 'product-kind', message: expect.stringContaining('a table Lathe already has') }),
    ]);
    // The product's own relation links only its own kinds.
    expect(await refused(store, [{ op: 'link', relation: 'documents', source: 'TL-LEND-CMD01', target: 'TL-V01' }])).toEqual([expect.objectContaining({ rule: 'foreign-key' })]);
    await store.close();
    const reopened = await openStore(root);
    expect(reopened.record('TL-LEND-RM01-REP01')?.kind).toBe('report');
    await reopened.close();
  });

  it("LA-CHK-UC02-R02-T03 the record_group view covers a product kind's group_name and a flow step's path", async () => {
    const { store } = await fresh();
    await store.apply([
      { op: 'add', table: 'product_kind', row: { name: 'house_rule', product_id: 'TL', label: 'House rule', description: 'A rule of the house.', parent_kind: 'domain', stage: 'use-cases', obligation: false } },
      { op: 'add', table: 'product_kind_field', row: { kind: 'house_rule', position: 1, name: 'group_name', type: 'text', required: false, description: 'Its heading.' } },
      { op: 'add', table: 'house_rule', row: { id: 'TL-LEND-HR01', title: 'Quiet', domain_id: 'TL-LEND', group_name: ' Noise' } },
      { op: 'add', table: 'house_rule', row: { id: 'TL-LEND-HR02', title: 'Tidy', domain_id: 'TL-LEND' } },
    ]);
    expect(await store.query("SELECT id, label FROM record_group WHERE id IN ('TL-LEND-HR01', 'TL-LEND-HR02', 'TL-LEND-UC01-FL-S01') ORDER BY id")).toEqual([
      { id: 'TL-LEND-HR01', label: ' Noise' },
      { id: 'TL-LEND-UC01-FL-S01', label: 'main' },
    ]);
    await store.close();
  });

  it('LA-AUT-INV34-T refuses an aggregate with two roots by its validation query, before any file changes', async () => {
    const { store } = await fresh();
    expect(await refused(store, [{ op: 'set', table: 'entity', key: 'TL-LEND-EN02', changes: { role: 'root', in_root_table: null } }])).toEqual([
      expect.objectContaining({ rule: 'aggregate-root', table: 'aggregate', key: 'TL-LEND-A1' }),
    ]);
    await store.close();
  });

  it('LA-AUT-INV36-T runs writes one after another, each on the state the one before left', async () => {
    const { store } = await fresh();
    await Promise.all([2, 3, 4].map((n) => store.add('view', { id: `TL-V0${n}`, title: `View ${n}` })));
    expect(store.rows('view').map((v) => v.id)).toEqual(['TL-V01', 'TL-V02', 'TL-V03', 'TL-V04']);
    const reader = await store.connect();
    expect((await reader.runAndReadAll('SELECT count(*)::INTEGER AS n FROM view')).getRowObjectsJson()).toEqual([{ n: 4 }]);
    reader.closeSync();
    await store.close();
  });
});
