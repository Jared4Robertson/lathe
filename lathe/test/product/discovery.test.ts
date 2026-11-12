// Discovery and test data (LA-PRD-UC22, LA-TST-UC13, LA-TRC-UC01, LA-TST-UC03, LA-TST-UC30): a product's business outcomes, the
// capabilities that serve them and what measures them, the test data sets tests start from, and a test's size and markers, proved
// through the store and the engine's load.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SchemaDescription } from '../../src/index.ts';
import { everyKind } from '../store/fixture.ts';
import { adding, changing, complete, gaps, loadData, refusals, removeData, without, withTable } from '../helpers.ts';
import { latheSchema, parentsOf, requiredOf } from '../shared.ts';

let schema: SchemaDescription;
beforeAll(async () => {
  schema = await latheSchema();
});
afterAll(removeData);

const rules = async (data: Parameters<typeof refusals>[0]) => (await refusals(data)).map((p) => p.rule);

describe('business outcomes', () => {
  it('LA-PRD-UC22-R01-T01 A business outcome sits under its product and gives a statement, its measure and its target', async () => {
    expect(parentsOf(schema, 'business_outcome')).toEqual(['product.product_id']);
    expect(requiredOf(schema, 'business_outcome')).toEqual(['product_id', 'statement', 'measure', 'target']);
    expect(schema.kinds.business_outcome).toMatchObject({ stage: 'discovery', idPattern: '<P>-BO<nn>', idScope: 'parent', obligation: false });
    const data = everyKind();
    const outcome = data.business_outcome[0];
    for (const column of ['statement', 'measure', 'target']) {
      const { [column]: _, ...without } = outcome;
      expect((await refusals(withTable(data, 'business_outcome', [without]))).map((p) => p.message)).toEqual([`business_outcome.${column} is required`]);
      expect(await rules(withTable(data, 'business_outcome', [{ ...outcome, [column]: '  ' }]))).toEqual(['column']);
    }
    // Its ID starts with its product's.
    expect(await rules(withTable(withTable(withTable(data, 'serves', []), 'measured_by', []), 'business_outcome', [{ ...outcome, id: 'XX-BO01' }]))).toEqual(['id-prefix']);
  });

  it('LA-MOD-UC33-R01-T01 A capability serves any number of business outcomes, and an outcome is served by any number of capabilities, of its own product', async () => {
    expect(schema.relations.serves).toMatchObject({ scope: 'product', role: null, forwardLabel: 'Serves', reverseLabel: 'Served by' });
    expect(schema.relations.serves.pairs.map((p) => `${p.source}>${p.target}`)).toEqual(['capability>business_outcome', 'journey>business_outcome']);
    const two = adding(everyKind(), {
      business_outcome: [{ id: 'TL-BO02', title: 'Tools back on time', product_id: 'TL', statement: 'Members return tools by their due date.', measure: 'Late returns per month.', target: 'Under one in twenty.' }],
      capability: [{ id: 'TL-LEND-CAP02', title: 'Returns', domain_id: 'TL-LEND', position: 2, description: 'Taking tools back.' }],
      serves: [{ source_id: 'TL-LEND-CAP01', target_id: 'TL-BO02' }, { source_id: 'TL-LEND-CAP02', target_id: 'TL-BO01' }, { source_id: 'TL-LEND-CAP02', target_id: 'TL-BO02' }],
    });
    expect(await refusals(two)).toEqual([]);
    // Only a capability serves, only an outcome is served, and never one of another product.
    expect(await rules(adding(everyKind(), { serves: [{ source_id: 'TL-LEND-UC01', target_id: 'TL-BO01' }] }))).toEqual(['foreign-key']);
    const other = adding(everyKind(), {
      product: [{ id: 'XX', title: 'Other', description: 'Another product beside the library.' }],
      business_outcome: [{ id: 'XX-BO01', title: 'Other', product_id: 'XX', statement: 'Something else happens.', measure: 'How often.', target: 'Often.' }],
      serves: [{ source_id: 'TL-LEND-CAP01', target_id: 'XX-BO01' }],
    });
    expect(await rules(other)).toEqual(['link-crosses-product']);
  });

  it('LA-PRD-UC41-R01-T01 An outcome is measured by tests of any kind, or by records of the product\'s own kinds it allows, or says how it is measured outside the code', async () => {
    expect(schema.relations.measured_by).toMatchObject({ scope: 'product', role: null, forwardLabel: 'Measured by', reverseLabel: 'Measures', sourceTable: 'business_outcome', targetTable: 'record_id' });
    // Every test kind, and nothing else of Lathe's, measures an outcome.
    const testKinds = Object.values(schema.kinds).filter((k) => k.stage === 'test-plan' && k.name !== 'test_data_set').map((k) => k.name).sort();
    expect(schema.relations.measured_by.pairs.map((p) => p.source)).toEqual(testKinds.map(() => 'business_outcome'));
    expect(schema.relations.measured_by.pairs.map((p) => p.target).sort()).toEqual(testKinds);
    const data = everyKind();
    const several = adding(data, { measured_by: [{ source_id: 'TL-BO01', target_id: 'TL-LEND-INV01-T' }, { source_id: 'TL-BO01', target_id: 'TL-INT01-T01' }] });
    expect(await refusals(several)).toEqual([]);
    // A record that is not a test is refused, until the product allows its own kind with a product_relation.
    expect(await rules(adding(data, { measured_by: [{ source_id: 'TL-BO01', target_id: 'TL-LEND-UC01' }] }))).toEqual(['relation-pair']);
    const kind = data.product_kind[0];
    const record = data[String(kind.name)][0];
    expect(await rules(adding(data, { measured_by: [{ source_id: 'TL-BO01', target_id: String(record.id) }] }))).toEqual(['relation-pair']);
    const allowed = adding(data, {
      product_relation: [{ name: 'measured_by', source_kind: 'business_outcome', target_kind: String(kind.name), product_id: 'TL', forward_label: 'Measured by', reverse_label: 'Measures', description: 'The outcome is measured by the report.' }],
      measured_by: [{ source_id: 'TL-BO01', target_id: String(record.id) }],
    });
    expect(await refusals(allowed)).toEqual([]);
    // Only an outcome is measured; never by a test of another product.
    expect(await rules(adding(data, { measured_by: [{ source_id: 'TL-LEND-UC01', target_id: 'TL-LEND-INV01-T' }] }))).toEqual(['foreign-key']);
    const other = adding(data, {
      product: [{ id: 'XX', title: 'Other', description: 'Another product beside the library.' }],
      business_outcome: [{ id: 'XX-BO01', title: 'Other', product_id: 'XX', statement: 'Something else happens.', measure: 'How often.', target: 'Often.' }],
      measured_by: [{ source_id: 'XX-BO01', target_id: 'TL-LEND-INV01-T' }],
    });
    expect(await rules(other)).toEqual(['link-crosses-product']);
    // How it is measured outside the code is optional text, never blank.
    expect(schema.tables.business_outcome.columns.find((c) => c.name === 'measured_outside')).toMatchObject({ required: false });
    const outcome = data.business_outcome[0];
    expect(await refusals(withTable(data, 'business_outcome', [{ ...outcome, measured_outside: 'Counted by the Owner from the sales ledger each month.' }]))).toEqual([]);
    expect(await rules(withTable(data, 'business_outcome', [{ ...outcome, measured_outside: '  ' }]))).toEqual(['column']);
  });

  it('LA-PRD-UC22-R03-T01 Discovery is the first stage, before the domain model, and the business outcome is its kind', () => {
    expect(schema.stages.map((s) => s.name)).toEqual(['discovery', 'domain-model', 'use-cases', 'interface-design', 'technical-specification', 'test-plan']);
    expect(schema.stages[0]).toMatchObject({ position: 1, label: 'Discovery' });
    expect(Object.values(schema.kinds).filter((k) => k.stage === 'discovery').map((k) => k.name)).toEqual(['business_outcome', 'journey', 'journey_step']);
    // They come right after the product in the kinds' order: the outcomes, then the journeys that reach them.
    const ordered = Object.values(schema.kinds).filter((k) => k.position !== null).sort((a, b) => a.position! - b.position!).map((k) => k.name);
    expect(ordered.slice(0, 5)).toEqual(['product', 'business_outcome', 'journey', 'journey_step', 'domain']);
  });

  it('LA-TRC-UC01-R16-T01 A business outcome no capability serves, and a capability that serves no outcome, are coverage gaps', async () => {
    expect(gaps(await loadData(complete()))).toEqual([]);
    const unlinked = await loadData(without(complete(), 'serves', () => true));
    expect(gaps(unlinked)).toEqual(['capability-serves-no-outcome EX-LEND-CAP01', 'outcome-not-served EX-BO01']);
    // The outcome's gap is the product's, outside every domain; the capability's is its domain's.
    expect(unlinked.coverage.find((c) => c.domain === null)?.gaps).toEqual([{ id: 'EX-BO01', kind: 'business_outcome', missing: 'outcome-not-served', message: 'Business outcome EX-BO01 is served by no capability.' }]);
    expect(unlinked.coverage.find((c) => c.domain === 'EX-LEND')?.gaps).toEqual([{ id: 'EX-LEND-CAP01', kind: 'capability', missing: 'capability-serves-no-outcome', message: 'Capability EX-LEND-CAP01 serves no business outcome.' }]);
    // Gaps, never problems; with no outcome served, what the use cases reach serves none (serves-no-outcome, LA-TRC-UC20-R02).
    expect(unlinked.problems.filter((p) => p.check !== 'serves-no-outcome')).toEqual([]);
  });
});

describe('measuring outcomes', () => {
  it('LA-TRC-UC01-R18-T01 A business outcome nothing that runs measures, and that names no measure outside the code, is a coverage gap', async () => {
    expect(gaps(await loadData(complete()))).toEqual([]);
    const unmeasured = await loadData(without(complete(), 'measured_by', () => true));
    expect(gaps(unmeasured)).toEqual(['outcome-not-measured EX-BO01']);
    // The product's gap, outside every domain; a gap, never a problem.
    expect(unmeasured.coverage.find((c) => c.domain === null)?.gaps).toEqual([{
      id: 'EX-BO01', kind: 'business_outcome', missing: 'outcome-not-measured',
      message: 'Business outcome EX-BO01 is measured by nothing; link the tests or records that measure it with measured_by, or say how it is measured outside the code.',
    }]);
    expect(unmeasured.problems).toEqual([]);
    // A test not automated yet measures nothing, so the gap stays and says why.
    const planned = await loadData(changing(complete(), 'use_case_test', (r) => r.id === 'EX-LEND-UC01-R01-T01', { state: 'not automated yet', file: undefined }));
    expect(planned.coverage.find((c) => c.domain === null)?.gaps.map((g) => g.message)).toEqual([
      'Business outcome EX-BO01 is measured by nothing that runs: each test that measures it is not automated yet, or its file is missing or does not name it; link the tests or records that measure it with measured_by, or say how it is measured outside the code.',
    ]);
    // A manual test measures it, and so does saying how it is measured outside the code.
    const manual = await loadData(changing(complete(), 'measured_by', () => true, { target_id: 'EX-INT01-T01' }));
    expect(gaps(manual)).toEqual([]);
    const outside = await loadData(changing(without(complete(), 'measured_by', () => true), 'business_outcome', () => true, { measured_outside: 'Counted by the Owner from the loan ledger each month.' }));
    expect(gaps(outside)).toEqual([]);
  });
});

describe('test data sets', () => {
  it('LA-TST-UC13-R08-T01 A test data set sits under a domain, and any kind of test starts from any number of them', async () => {
    expect(parentsOf(schema, 'test_data_set')).toEqual(['domain.domain_id']);
    expect(requiredOf(schema, 'test_data_set')).toEqual(['domain_id', 'environment', 'records', 'prepare', 'reset', 'description']);
    expect(schema.tables.test_data_set.columns.map((c) => c.name)).toEqual(['id', 'title', 'domain_id', 'environment', 'accounts', 'records', 'prepare', 'reset', 'file', 'description']);
    expect(schema.kinds.test_data_set).toMatchObject({ stage: 'test-plan', idPattern: '<P>-<D>-TD<nn>', idScope: 'domain', obligation: false });
    // Every test kind, and only a test, starts from a data set.
    const testKinds = Object.values(schema.kinds).filter((k) => k.stage === 'test-plan' && k.name !== 'test_data_set').map((k) => k.name).sort();
    expect(schema.relations.starts_from.pairs.map((p) => p.source).sort()).toEqual(testKinds);
    expect(new Set(schema.relations.starts_from.pairs.map((p) => p.target))).toEqual(new Set(['test_data_set']));
    const data = everyKind();
    const second = adding(data, {
      test_data_set: [{ id: 'TL-LEND-TD02', title: 'An overdue loan', domain_id: 'TL-LEND', environment: 'A fresh test database.', records: 'One loan a week overdue.', prepare: 'Load the overdue loan before the test.', reset: 'Drop the database after the test.', description: 'A library with one loan past its due date.' }],
      starts_from: [{ source_id: 'TL-INT01-T01', target_id: 'TL-LEND-TD02' }, { source_id: 'TL-LEND-INV01-T', target_id: 'TL-LEND-TD01' }],
    });
    expect(await refusals(second)).toEqual([]);
    expect(await rules(adding(data, { starts_from: [{ source_id: 'TL-LEND-UC01', target_id: 'TL-LEND-TD01' }] }))).toEqual(['foreign-key']);
    // Its ID starts with its domain's.
    const misnamed = withTable(withTable(data, 'starts_from', []), 'test_data_set', [{ ...data.test_data_set[0], id: 'TL-SHOP-TD01' }]);
    expect(await rules(misnamed)).toEqual(['id-prefix']);
  });
});

describe('a test\'s size and markers', () => {
  it('LA-TST-UC30-R01-T01 A test is small unless it says volume or worst case, and marks itself smoke or external only by saying yes', async () => {
    for (const kind of Object.values(schema.kinds).filter((k) => k.stage === 'test-plan' && k.name !== 'test_data_set')) {
      const columns = Object.fromEntries(schema.tables[kind.name].columns.map((c) => [c.name, c]));
      expect(columns.size, kind.name).toMatchObject({ required: false, kind: 'enum', values: ['volume', 'worst case'] });
      expect(columns.smoke, kind.name).toMatchObject({ required: false, kind: 'boolean' });
      expect(columns.external, kind.name).toMatchObject({ required: false, kind: 'boolean' });
    }
    const test = (changes: Record<string, string | boolean | undefined>) => changing(complete(), 'use_case_test', (r) => r.id === 'EX-LEND-UC01-R01-T01', changes);
    expect(await refusals(test({ size: 'volume', smoke: true, external: true }))).toEqual([]);
    expect(await refusals(test({ size: 'worst case' }))).toEqual([]);
    // Small is the size given by none, so it is never written; a marker that is not set is left out.
    expect(await rules(test({ size: 'small' }))).toEqual(['column']);
    expect(await rules(test({ smoke: false }))).toEqual(['check']);
    expect(await rules(test({ external: false }))).toEqual(['check']);
  });
});
