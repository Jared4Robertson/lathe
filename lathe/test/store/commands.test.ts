// The store under each aggregate's commands: every command is one transaction that validates before it writes, and
// rewrites only the files of the tables it changed.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ALL_COMMANDS } from '../../src/commands.ts';
import { openStore, type Store } from '../../src/index.ts';
import { refusedBy, run } from '../helpers.ts';
import { everyKind, removeData, writeData } from './fixture.ts';

afterAll(removeData);

async function fresh(): Promise<{ store: Store; root: string }> {
  const root = writeData(everyKind());
  return { store: await openStore(root), root };
}

/** SQL over the store's data built whole: a write holds its state without building it, so its SQL waits for whole(). */
async function sql<T = Record<string, unknown>>(store: Store, text: string): Promise<T[]> {
  const built = await store.whole((data) => data.query<T>(text));
  if (!built) throw new Error('The data changed while it was built.');
  return built.value;
}

const files = (root: string) =>
  Object.fromEntries(readdirSync(path.join(root, 'data')).map((f) => [f, readFileSync(path.join(root, 'data', f), 'utf8')]));
const mtimes = (root: string) => Object.fromEntries(readdirSync(path.join(root, 'data')).map((f) => [f, statSync(path.join(root, 'data', f)).mtimeMs]));

describe('adding', () => {
  it('LA-PAT-AGGREGATE-COMMANDS-R05-T01 LA-PAT-AGGREGATE-COMMANDS-R05-T04 LA-PAT-AGGREGATE-COMMANDS-R05-T05 LA-PAT-AGGREGATE-COMMANDS-R05-T06 LA-PAT-AGGREGATE-COMMANDS-R05-T07 LA-PAT-AGGREGATE-COMMANDS-R05-T08 adds a record, registers its ID and supertypes, and rewrites only its table file', async () => {
    const { store, root } = await fresh();
    const before = mtimes(root);
    const result = await run(store, 'use-case add-uc-requirement', { id: 'TL-LEND-UC01-R02', title: 'Member is known', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse an unknown member.' });
    expect({ tables: result.tables, files: result.files }).toEqual({ tables: ['uc_requirement'], files: ['uc_requirement.jsonl'] });
    expect(store.record('TL-LEND-UC01-R02')?.kind).toBe('uc_requirement');
    expect(await sql(store, "SELECT kind FROM record_id WHERE id = 'TL-LEND-UC01-R02'")).toEqual([{ kind: 'uc_requirement' }]);
    expect(await sql(store, "SELECT kind FROM obligation WHERE id = 'TL-LEND-UC01-R02'")).toEqual([{ kind: 'uc_requirement' }]);
    const after = mtimes(root);
    expect(Object.keys(after).filter((f) => after[f] !== before[f])).toEqual(['uc_requirement.jsonl']);
    expect(readFileSync(path.join(root, 'data', 'uc_requirement.jsonl'), 'utf8').split('\n')[1]).toBe(
      '{"id":"TL-LEND-UC01-R02","title":"Member is known","use_case_id":"TL-LEND-UC01","statement":"The library MUST refuse an unknown member."}',
    );
    await store.close();
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R05-T01 LA-PAT-AGGREGATE-COMMANDS-R05-T04 LA-PAT-AGGREGATE-COMMANDS-R05-T05 LA-PAT-AGGREGATE-COMMANDS-R05-T06 LA-PAT-AGGREGATE-COMMANDS-R05-T07 LA-PAT-AGGREGATE-COMMANDS-R05-T08 adds a record of each new kind: one with no owner, one under either of two parents, and a test', async () => {
    const { store } = await fresh();
    await run(store, 'specification add-specification', { id: 'TL-LEND-SP02', title: 'Member in good standing', statement: 'A member owes nothing.', reads: ['TL-LEND-A1'] });
    await run(store, 'endpoint add-endpoint', { id: 'TL-LEND-EP02', title: 'GET /tools/free', query_id: 'TL-LEND-QRY01', method: 'GET', route: '/tools/free', description: 'Answers 200 with the free tools.' });
    await run(store, 'specification add-specification-test', { id: 'TL-LEND-SP02-T', title: 'Good standing', specification_id: 'TL-LEND-SP02', level: 'unit', state: 'manual', manual_reason: 'Not yet coded.', when: 'Checks a member who owes nothing', then: 'They are in good standing' });
    expect(await sql(store, "SELECT * FROM record_scope WHERE id IN ('TL-LEND-SP02', 'TL-LEND-EP02', 'TL-LEND-SP02-T') ORDER BY id")).toEqual([
      { id: 'TL-LEND-EP02', product_id: 'TL', domain_id: 'TL-LEND', aggregate_id: null },
      { id: 'TL-LEND-SP02', product_id: 'TL', domain_id: 'TL-LEND', aggregate_id: null },
      { id: 'TL-LEND-SP02-T', product_id: 'TL', domain_id: 'TL-LEND', aggregate_id: null },
    ]);
    expect(await sql(store, "SELECT parent_id FROM record_parent WHERE id = 'TL-LEND-EP02'")).toEqual([{ parent_id: 'TL-LEND-QRY01' }]);
    await store.close();
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R07-T01 LA-PAT-AGGREGATE-COMMANDS-R07-T04 LA-PAT-AGGREGATE-COMMANDS-R07-T05 LA-PAT-AGGREGATE-COMMANDS-R07-T06 LA-PAT-AGGREGATE-COMMANDS-R07-T07 LA-PAT-AGGREGATE-COMMANDS-R07-T08 refuses a record whose ID is taken and a record under a parent that does not exist', async () => {
    const { store } = await fresh();
    expect(await refusedBy(store, 'view add-view', { id: 'TL-V01', title: 'Again', description: 'The catalog again.' })).toEqual([expect.objectContaining({ rule: 'primary-key' })]);
    expect(await refusedBy(store, 'view add-view-requirement', { id: 'TL-V09-R01', title: 'Lost', view_id: 'TL-V09', statement: 'x' })).toEqual([expect.objectContaining({ rule: 'missing' })]);
    await store.close();
  });
});

describe('record_scope', () => {
  it('LA-STD-MODELING-R16-T02 a record with no owner belongs to the one domain that uses it, with what sits under it, and is shared when two or none do', async () => {
    const { store } = await fresh();
    const domains = async (ids: string[]) =>
      Object.fromEntries(
        (await sql<{ id: string; domain_id: string | null }>(store, `SELECT id, domain_id FROM record_scope WHERE id IN (${ids.map((id) => `'${id}'`).join(', ')})`)).map((r) => [r.id, r.domain_id]),
      );
    // Lending's one flow step exchanges with the integration, its command is presented in the view with the integration, the view's UI component renders
    // it, and a Lending entity's field is typed by the value object: all four, and what sits under them, are Lending's.
    const lending = ['TL-V01', 'TL-V01-R01', 'TL-V01-R01-T01', 'TL-INT01', 'TL-INT01-AD', 'TL-INT01-T01', 'TL-UI01', 'TL-VO01', 'TL-VO01-C01', 'TL-VO01-C01-T', 'TL-VO01-VT'];
    expect(await domains(lending)).toEqual(Object.fromEntries(lending.map((id) => [id, 'TL-LEND'])));
    // A second domain's query is presented in the same view, and its read model has a field typed by a new value
    // object; a third value object is used by no one.
    await run(store, 'domain add-domain', { id: 'TL-CAT', title: 'Catalog', product_id: 'TL', position: 2, subdomain_type: 'supporting', description: 'The tools the library holds.' });
    await run(store, 'domain add-capability', { id: 'TL-CAT-CAP01', title: 'Browsing', domain_id: 'TL-CAT', position: 1, description: 'Browsing the tools on the shelf.' });
    await run(store, 'use-case add-use-case', { id: 'TL-CAT-UC01', title: 'Browse the tools', capability_id: 'TL-CAT-CAP01', goal: 'A member finds a tool to borrow.', result_id: 'TL-LEND-CMD01' });
    await run(store, 'use-case add-flow', { id: 'TL-CAT-UC01-FL', title: 'Browse', use_case_id: 'TL-CAT-UC01' });
    await run(store, 'use-case add-flow-step', { id: 'TL-CAT-UC01-FL-S01', title: 'Open the catalog', flow_id: 'TL-CAT-UC01-FL', path: 'main', position: 1 });
    await run(store, 'value-object add-value-object', { id: 'TL-VO02', title: 'Tool size', description: 'How big a tool is.' });
    await run(store, 'value-object add-value-object', { id: 'TL-VO03', title: 'Postcode', description: 'Where a member lives.' });
    await run(store, 'read-model add-read-model', {
      id: 'TL-CAT-RM01',
      title: 'Tools by size',
      domain_id: 'TL-CAT',
      description: 'The tools, grouped by size.',
      fields: [{ name: 'Size', meaning: 'How big the tool is.', type_value_object_id: 'TL-VO02', required: true }],
    });
    await run(store, 'read-model add-query', { id: 'TL-CAT-QRY01', title: 'List tools by size', read_model_id: 'TL-CAT-RM01', description: 'The tools, grouped by size.' });
    await run(store, 'view change-view', { id: 'TL-V01', presents: ['TL-LEND-CMD01', 'TL-CAT-QRY01'] });
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
    expect(await sql(store, "SELECT product_id FROM record_scope WHERE id = 'TL-V01'")).toEqual([{ product_id: 'TL' }]);
    await store.close();
  });
});

describe('moving', () => {
  it('LA-IXD-UC18-R05-T03 a view, which has no owner, has no move: only records with a parent, or a domain their ID names, move', () => {
    expect(ALL_COMMANDS.filter((c) => c.name.startsWith('move-')).map((c) => `${c.slice.name} ${c.name}`).sort()).toEqual([
      'aggregate move-aggregate',
      'data-store move-data-store',
      'domain move-capability',
      'domain move-domain-service',
      'domain move-repository',
      'domain move-term',
      'endpoint move-endpoint',
      'entry-point move-entry-point',
      'extension-record move-extension-record',
      'journey move-journey-step',
      'product move-question',
      'read-model move-read-model',
      'specification move-specification',
      'table move-table',
      'test-data-set move-test-data-set',
      'tooling move-tooling',
      'use-case move-flow-step',
      'use-case move-uc-requirement',
      'use-case move-use-case',
    ]);
  });
});

describe('links', () => {
  it('LA-PAT-AGGREGATE-COMMANDS-R05-T01 LA-PAT-AGGREGATE-COMMANDS-R05-T04 LA-PAT-AGGREGATE-COMMANDS-R05-T05 LA-PAT-AGGREGATE-COMMANDS-R05-T06 LA-PAT-AGGREGATE-COMMANDS-R05-T07 LA-PAT-AGGREGATE-COMMANDS-R05-T08 a record\'s links are inputs of its own change, keeping the file sorted by its key columns', async () => {
    const { store, root } = await fresh();
    await run(store, 'read-model change-query', { id: 'TL-LEND-QRY01', calls: ['TL-LEND-DS01'] });
    expect(readFileSync(path.join(root, 'data', 'calls.jsonl'), 'utf8')).toBe(
      ['TL-LEND-CMD01', 'TL-LEND-QRY01'].map((s) => `{"source_id":"${s}","target_id":"TL-LEND-DS01"}\n`).join(''),
    );
    await run(store, 'read-model change-query', { id: 'TL-LEND-QRY01', calls: [] });
    expect(store.rows('calls')).toHaveLength(1);
    await store.close();
  });

  it('LA-STD-MODELING-R18-T02 refuses a link its ends allow but its relation does not, and a wrong kind at an end', async () => {
    const { store } = await fresh();
    // A second pair widens documents to a link table whose target is any record, so its pairs are what hold.
    await run(store, 'product declare-product-relation', { name: 'documents', source_kind: 'cli_command', target_kind: 'integration', product_id: 'TL', forward_label: 'Documents', reverse_label: 'Documented by', description: 'The CLI command is documented with the integration.' });
    expect(store.schema.relations.documents.targetTable).toBe('record_id');
    expect(await refusedBy(store, 'extension-record change-extension-record', { id: 'TL-LEND-CMD01-CLI', links: { documents: ['TL-LEND-UC01-R01'] } })).toEqual([
      expect.objectContaining({ rule: 'relation-pair', message: expect.stringContaining('TL-LEND-CMD01-CLI (a cli_command) cannot documents TL-LEND-UC01-R01 (a uc_requirement)') }),
    ]);
    expect(await refusedBy(store, 'read-model change-query', { id: 'TL-LEND-QRY01', calls: ['TL-LEND-UC01'] })).toEqual([
      expect.objectContaining({ rule: 'foreign-key', message: expect.stringContaining('names no domain_service') }),
    ]);
    await store.close();
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R07-T01 LA-PAT-AGGREGATE-COMMANDS-R07-T04 LA-PAT-AGGREGATE-COMMANDS-R07-T05 LA-PAT-AGGREGATE-COMMANDS-R07-T06 LA-PAT-AGGREGATE-COMMANDS-R07-T07 LA-PAT-AGGREGATE-COMMANDS-R07-T08 refuses a link to another product', async () => {
    const { store } = await fresh();
    await run(store, 'product add-product', { id: 'LA', title: 'Lathe', description: 'A tool for writing specs.' });
    await run(store, 'domain add-domain', { id: 'LA-PRD', title: 'Product', product_id: 'LA', position: 1, subdomain_type: 'core', description: 'Writing the records of a spec.' });
    await run(store, 'aggregate add-aggregate', { id: 'LA-PRD-A1', title: 'Record', domain_id: 'LA-PRD', identity: 'Record ID', description: 'One record of a spec.' });
    expect(await refusedBy(store, 'read-model change-read-model', { id: 'TL-LEND-RM01', reads: ['TL-LEND-A1', 'LA-PRD-A1'] })).toEqual([expect.objectContaining({ rule: 'link-crosses-product' })]);
    await store.close();
  });
});

describe('a command', () => {
  describe('LA-STD-PRINCIPLES-R01-T02 a refused command changes nothing', () => {
    it('LA-PAT-AGGREGATE-COMMANDS-R03-T01 LA-PAT-AGGREGATE-COMMANDS-R03-T04 LA-PAT-AGGREGATE-COMMANDS-R03-T05 LA-PAT-AGGREGATE-COMMANDS-R03-T06 LA-PAT-AGGREGATE-COMMANDS-R03-T07 LA-PAT-AGGREGATE-COMMANDS-R03-T08 is all or nothing: a refused command leaves the data and the files as they were', async () => {
      const { store, root } = await fresh();
      const before = files(root);
      // An automated test with no file breaks the table's own rule at the commit, after the command has run.
      const problems = await refusedBy(store, 'domain add-domain-service-test', { id: 'TL-LEND-DS01-T02', title: 'Broken', domain_service_id: 'TL-LEND-DS01', level: 'unit', state: 'automated', when: 'Works out a due date', then: 'It is 14 days on' });
      expect(problems).toEqual([expect.objectContaining({ rule: 'check' })]);
      expect(store.record('TL-LEND-DS01-T02')).toBeUndefined();
      expect(await sql(store, "SELECT id FROM domain_service_test WHERE id = 'TL-LEND-DS01-T02'")).toEqual([]);
      expect(files(root)).toEqual(before);
      await store.close();
    });
  });

  it('LA-PLT-UC02-R03-T02 declares a product kind in any stage, then adds its records', async () => {
    const { store, root } = await fresh();
    await run(store, 'product declare-product-kind', {
      name: 'report',
      product_id: 'TL',
      label: 'Report',
      description: 'A report the library prints.',
      parent_kind: 'read_model',
      stage: 'interface-design',
      obligation: true, complexity: 'essential',
      id_pattern: '<read model>-REP<nn>',
      fields: [{ name: 'printed_on', type: 'date', required: false, description: 'When it was printed.' }],
    });
    await run(store, 'extension-record add-extension-record', { kind: 'report', id: 'TL-LEND-RM01-REP01', parent_id: 'TL-LEND-RM01', values: { title: 'Overdue loans', printed_on: '2026-03-02' } });
    expect(store.schema.kinds.report).toMatchObject({ productId: 'TL', stage: 'interface-design', obligation: true, idScope: null, parents: [{ kind: 'read_model', column: 'read_model_id' }] });
    expect(store.schema.supertypes.obligation).toContain('report');
    expect(readFileSync(path.join(root, 'data', 'report.jsonl'), 'utf8')).toBe('{"id":"TL-LEND-RM01-REP01","title":"Overdue loans","read_model_id":"TL-LEND-RM01","printed_on":"2026-03-02"}\n');
    expect(await refusedBy(store, 'extension-record add-extension-record', { kind: 'report', id: 'TL-LEND-RM01-REP02', parent_id: 'TL-LEND-RM01', values: { title: 'x', printed_on: '2026-02-30' } })).toEqual([
      expect.objectContaining({ rule: 'column' }),
    ]);
    expect(await refusedBy(store, 'product declare-product-kind', { name: 'view', product_id: 'TL', label: 'View', description: 'Again.', parent_kind: 'domain', stage: 'use-cases', obligation: false, complexity: 'essential' })).toEqual([
      expect.objectContaining({ rule: 'product-kind-declared', message: expect.stringContaining('a table Lathe already has') }),
    ]);
    await store.close();
    const reopened = await openStore(root);
    expect(reopened.record('TL-LEND-RM01-REP01')?.kind).toBe('report');
    await reopened.close();
  });

  it("LA-CHK-UC02-R02-T03 the record_group view covers a product kind's group_name and a flow step's path", async () => {
    const { store } = await fresh();
    await run(store, 'product declare-product-kind', {
      name: 'house_rule',
      product_id: 'TL',
      label: 'House rule',
      description: 'A rule of the house.',
      parent_kind: 'domain',
      stage: 'use-cases',
      obligation: false, complexity: 'essential',
      fields: [{ name: 'group_name', type: 'text', required: false, description: 'Its heading.' }],
    });
    await run(store, 'extension-record add-extension-record', { kind: 'house_rule', id: 'TL-LEND-HR01', parent_id: 'TL-LEND', values: { title: 'Quiet', group_name: ' Noise' } });
    await run(store, 'extension-record add-extension-record', { kind: 'house_rule', id: 'TL-LEND-HR02', parent_id: 'TL-LEND', values: { title: 'Tidy' } });
    expect(await sql(store, "SELECT id, label FROM record_group WHERE id IN ('TL-LEND-HR01', 'TL-LEND-HR02', 'TL-LEND-UC01-FL-S01') ORDER BY id")).toEqual([
      { id: 'TL-LEND-HR01', label: ' Noise' },
      { id: 'TL-LEND-UC01-FL-S01', label: 'main' },
    ]);
    await store.close();
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R04-T01 LA-PAT-AGGREGATE-COMMANDS-R04-T04 LA-PAT-AGGREGATE-COMMANDS-R04-T05 LA-PAT-AGGREGATE-COMMANDS-R04-T06 LA-PAT-AGGREGATE-COMMANDS-R04-T07 LA-PAT-AGGREGATE-COMMANDS-R04-T08 refuses an aggregate with two roots, before any file changes', async () => {
    const { store } = await fresh();
    expect(await refusedBy(store, 'aggregate change-entity', { id: 'TL-LEND-EN02', role: 'root', in_root_table: null })).toEqual([
      expect.objectContaining({ rule: 'aggregate-root', table: 'aggregate', message: expect.stringContaining('aggregate TL-LEND-A1 has 2 root entities') }),
    ]);
    await store.close();
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R06-T01 LA-PAT-AGGREGATE-COMMANDS-R06-T04 LA-PAT-AGGREGATE-COMMANDS-R06-T05 LA-PAT-AGGREGATE-COMMANDS-R06-T06 LA-PAT-AGGREGATE-COMMANDS-R06-T07 LA-PAT-AGGREGATE-COMMANDS-R06-T08 runs commands one after another, each on the state the one before left', async () => {
    const { store } = await fresh();
    await Promise.all([2, 3, 4].map((n) => run(store, 'view add-view', { id: `TL-V0${n}`, title: `View ${n}`, description: 'A page of the desk app.' })));
    expect(store.rows('view').map((v) => v.id)).toEqual(['TL-V01', 'TL-V02', 'TL-V03', 'TL-V04']);
    expect(await sql(store, 'SELECT count(*)::INTEGER AS n FROM view')).toEqual([{ n: 4 }]);
    await store.close();
  });
});
