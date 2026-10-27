// Coverage: every obligation designed, built and proved, per domain and for the product outside the domains, and the
// records short of a minimum. Each case starts from the complete product, where everything is covered.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GAP_RULES, type Workspace } from '../src/index.ts';
import { adding, changing, complete, gaps, loadData, obligation, removeData, sparse, without } from './helpers.ts';

afterAll(removeData);

const covered = (total: number) => ({ total, designed: total, built: total, proved: total, not_automated: 0 });

let clean: Workspace;
beforeAll(async () => {
  clean = await loadData(complete());
});

describe('coverage of the complete product', () => {
  it('LA-TRC-T04 counts every obligation kind, in kind order, per domain and for the product outside the domains', () => {
    expect(clean.coverage.map((c) => [c.product, c.domain])).toEqual([['EX', 'EX-LEND'], ['EX', null]]);
    const lending = clean.coverage[0];
    expect(lending.obligations.map((o) => o.kind)).toEqual(['constraint', 'invariant', 'specification', 'policy', 'domain_service', 'uc_requirement', 'pattern_rule', 'view_requirement', 'api_requirement', 'standard_rule']);
    expect(obligation(clean, 'EX-LEND', 'uc_requirement')).toMatchObject({ label: 'UC requirement', proof_only: false, ...covered(2) });
    expect(obligation(clean, 'EX-LEND', 'pattern_rule')).toMatchObject({ proof_only: true, ...covered(1) });
    for (const kind of ['invariant', 'specification', 'policy', 'domain_service', 'api_requirement']) expect(obligation(clean, 'EX-LEND', kind), kind).toMatchObject(covered(1));
    // A constraint, a view requirement and a standard rule sit outside every domain: under a value object, a view, a standard.
    for (const kind of ['constraint', 'view_requirement', 'standard_rule']) {
      expect(obligation(clean, null, kind), kind).toMatchObject(covered(1));
      expect(obligation(clean, 'EX-LEND', kind), kind).toMatchObject({ total: 0 });
    }
    expect(gaps(clean)).toEqual([]);
  });

  it('LA-TRC-T05 counts the tests of each scope by state', () => {
    expect(clean.coverage[0].tests).toEqual({ automated: 9, manual: 1, not_automated: 0 });
    expect(clean.coverage[1].tests).toEqual({ automated: 2, manual: 1, not_automated: 0 });
  });
});

describe('designed and built', () => {
  let ws: Workspace;
  beforeAll(async () => {
    let data = without(complete(), 'value_type', () => true);
    data = without(data, 'predicate', () => true);
    data = without(data, 'event_handler', () => true);
    data = without(data, 'renders', () => true);
    data = without(data, 'endpoint_handler', () => true);
    data = without(data, 'meets', (r) => r.source_id === 'EX-LEND-CMD01-H');
    data = without(data, 'fulfills', (r) => r.source_id === 'EX-LEND-UC02-FL-S01');
    ws = await loadData(data, { missing: ['src/dates.ts'] });
  });

  it('a UC requirement is designed once a step fulfills it, a standard rule once a technical record meets it; the rest by construction', () => {
    expect(gaps(ws).filter((g) => g.startsWith('designed'))).toEqual([
      'designed EX-LEND-UC02-R01', // no step fulfills it
      'designed EX-STD-CODE-R01', // no technical record meets it
    ]);
    expect(obligation(ws, null, 'constraint')).toMatchObject({ total: 1, designed: 1, built: 0, proved: 1 });
  });

  it('LA-TRC-T02 an obligation is built once the technical record that implements it names a file that exists, counted apart from designed and proved', () => {
    expect(gaps(ws).filter((g) => g.startsWith('built'))).toEqual([
      'built EX-LEND-DS01', // its service's file is missing
      'built EX-LEND-EP01-R01', // its endpoint has no handler
      'built EX-LEND-PO01', // no event handler
      'built EX-LEND-SP01', // no predicate
      'built EX-V01-R01', // no UI component renders its view
      'built EX-VO01-C01', // its value object has no value type
    ]);
    expect(obligation(ws, 'EX-LEND', 'domain_service')).toMatchObject({ total: 1, designed: 1, built: 0, proved: 1 });
    // An obligation not designed is not reported as not built as well.
    expect(gaps(ws)).not.toContain('built EX-LEND-UC02-R01');
  });

  it('an invariant is built by a data model of its aggregate, or by the table of a unique key naming it', async () => {
    const noModels = without(complete(), 'data_model', (r) => r.entity_id !== 'EX-LEND-EN03');
    const bare = await loadData(noModels);
    expect(gaps(bare)).toEqual(['built EX-LEND-INV01', 'entity-without-data-model EX-LEND-EN01', 'entity-without-data-model EX-LEND-EN02']);
    const key = { table_key: [{ table_id: 'EX-LEND-EN01-TB', position: 2, type: 'unique', columns: ['tool_id'], invariant_id: 'EX-LEND-INV01' }] };
    expect(obligation(await loadData(adding(noModels, key)), 'EX-LEND', 'invariant')).toMatchObject({ designed: 1, built: 1 });
    expect(obligation(await loadData(adding(noModels, key), { missing: ['src/schema.sql'] }), 'EX-LEND', 'invariant')).toMatchObject({ designed: 1, built: 0 });
  });

  it("a UC requirement is built through what its steps invoke, or a UI component of the view a step happens in", async () => {
    // The step that fulfills UC01-R01 invokes nothing now; it still happens in the catalog, which a UI component renders.
    const viaView = await loadData(without(complete(), 'invokes', (r) => r.source_id === 'EX-LEND-UC01-FL-S01'));
    expect(obligation(viaView, 'EX-LEND', 'uc_requirement')).toMatchObject(covered(2));
    const nowhere = await loadData(without(without(complete(), 'invokes', (r) => r.source_id === 'EX-LEND-UC01-FL-S01'), 'happens_in', (r) => r.source_id === 'EX-LEND-UC01-FL-S01'));
    expect(gaps(nowhere)).toEqual(['built EX-LEND-UC01-R01']);
    expect(nowhere.coverage[0].gaps[0]).toEqual({ id: 'EX-LEND-UC01-R01', kind: 'uc_requirement', missing: 'built', message: 'UC requirement EX-LEND-UC01-R01 is not built yet: no file of what implements it exists.' });
  });
});

describe('proved', () => {
  let ws: Workspace;
  beforeAll(async () => {
    let data = changing(complete(), 'constraint_test', () => true, { level: 'api' });
    data = changing(data, 'specification_test', () => true, { state: 'not automated yet' });
    data = changing(data, 'view_test', () => true, { level: 'manual', state: 'manual', manual_reason: 'Looked at by eye.', file: undefined });
    data = without(data, 'meets', (r) => r.source_id === 'EX-LEND-EP01-R01-T01');
    ws = await loadData(data, { silent: ['EX-LEND-PO01-T'] });
  });

  it('LA-TRC-T05 only an automated or manual test at an allowed level, whose file names it, proves', () => {
    expect(gaps(ws)).toEqual(['proved EX-LEND-PO01', 'proved EX-LEND-SP01', 'proved EX-STD-CODE-R01', 'proved EX-VO01-C01']);
    // A manual test proves.
    expect(obligation(ws, null, 'view_requirement')).toMatchObject(covered(1));
  });

  it('a test not automated yet leaves its obligation unproved, counted and named as such', () => {
    expect(obligation(ws, 'EX-LEND', 'specification')).toMatchObject({ total: 1, proved: 0, not_automated: 1 });
    expect(ws.coverage[0].gaps.find((g) => g.id === 'EX-LEND-SP01')?.message).toBe('Specification EX-LEND-SP01 is not proved yet: its test is not automated yet.');
    expect(ws.coverage[0].tests).toEqual({ automated: 8, manual: 1, not_automated: 1 });
  });

  it('a standard rule is proved by a test that meets it', () => {
    expect(obligation(ws, null, 'standard_rule')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 0 });
  });
});

describe('pattern rules', () => {
  const shop = (data = complete()) =>
    adding(data, {
      domain: [{ id: 'EX-SHOP', title: 'Shop', product_id: 'EX', subdomain_type: 'supporting' }],
      capability: [{ id: 'EX-SHOP-CAP01', title: 'Selling', domain_id: 'EX-SHOP', position: 1 }],
      use_case: [{ id: 'EX-SHOP-UC01', title: 'Sell a tool', capability_id: 'EX-SHOP-CAP01' }],
    });

  it("LA-TRC-T21 each domain that follows a pattern owes its rules, proved only by its own pattern rule test", async () => {
    const data = adding(shop(), {
      follows: [{ source_id: 'EX-SHOP-UC01', target_id: 'EX-PAT-ACT' }],
      setting_value: [{ follower_id: 'EX-SHOP-UC01', pattern_id: 'EX-PAT-ACT', setting: 'record', value: 'Sale' }],
    });
    const ws = await loadData(data);
    expect(obligation(ws, 'EX-LEND', 'pattern_rule')).toMatchObject({ proof_only: true, ...covered(1) });
    expect(obligation(ws, 'EX-SHOP', 'pattern_rule')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 0 });
    expect(ws.coverage.find((c) => c.domain === 'EX-SHOP')?.gaps.find((g) => g.missing === 'proved')?.message).toBe('Pattern rule EX-PAT-ACT-R01 is not proved yet in EX-SHOP.');
  });

  it('LA-TRC-T22 a domain that does not follow the pattern owes none of its rules', async () => {
    const ws = await loadData(shop());
    expect(obligation(ws, 'EX-SHOP', 'pattern_rule')).toMatchObject({ total: 0 });
  });

  it('LA-TRC-T25 a rule whose setting every following use case marks not applicable is waived there; a domain following itself owes it', async () => {
    const data = changing(changing(complete(), 'pattern_rule', () => true, { setting: 'record' }), 'setting_value', () => true, { value: undefined, not_applicable: 'Adds nothing.' });
    const waived = await loadData(data);
    expect(obligation(waived, 'EX-LEND', 'pattern_rule')).toMatchObject({ total: 0 });
    const itself = await loadData(adding(data, { follows: [{ source_id: 'EX-LEND', target_id: 'EX-PAT-ACT' }] }));
    expect(obligation(itself, 'EX-LEND', 'pattern_rule')).toMatchObject(covered(1));
  });

  it('LA-TRC-T118 a rule no follower meets the applies-when setting of is waived in that domain', async () => {
    const when = (value: string, negated = false) => changing(complete(), 'pattern_rule', () => true, { applies_when_setting: 'record', applies_when_value: value, applies_when_negated: negated });
    expect(obligation(await loadData(when(' tool ')), 'EX-LEND', 'pattern_rule')).toMatchObject({ total: 1 });
    expect(obligation(await loadData(when('Loan')), 'EX-LEND', 'pattern_rule')).toMatchObject({ total: 0 });
    expect(obligation(await loadData(when('Loan', true)), 'EX-LEND', 'pattern_rule')).toMatchObject({ total: 1 });
  });
});

describe('minimums', () => {
  it('a record short of each minimum is a gap, under its own scope, named by the rule', async () => {
    const ws = await loadData(sparse());
    const found = new Set(ws.coverage.flatMap((c) => c.gaps.map((g) => g.missing)));
    for (const rule of GAP_RULES) expect(found.has(rule.name), rule.name).toBe(true);
    // A view sits outside every domain, so its gap is the product's; a use case's is its domain's.
    expect(ws.coverage.find((c) => c.domain === null)?.gaps).toContainEqual({ id: 'SP-V01', kind: 'view', missing: 'view-without-ui-component', message: 'View SP-V01 is rendered by no UI component.' });
    expect(ws.coverage.find((c) => c.domain === 'SP-D')?.gaps).toContainEqual({ id: 'SP-D-UC01', kind: 'use_case', missing: 'use-case-without-flow', message: 'Use case SP-D-UC01 has no flow.' });
    expect(ws.coverage.find((c) => c.domain === 'SP-E')?.gaps).toEqual([{ id: 'SP-E', kind: 'domain', missing: 'domain-without-aggregate', message: 'Domain SP-E has no aggregate.' }]);
    // Gaps are coverage, never problems.
    expect(ws.problems.map((p) => p.check).sort()).toEqual(['not-built', 'not-built', 'not-built', 'not-proved', 'not-proved', 'not-proved', 'pattern-not-followed', 'value-object-unused']);
  });

  it('every gap rule has a unique name, a stage and a summary, and the complete product meets every minimum', () => {
    expect(new Set(GAP_RULES.map((g) => g.name)).size).toBe(GAP_RULES.length);
    for (const g of GAP_RULES) expect(g.summary, g.name).toMatch(/^An? .+\.$/);
    expect(gaps(clean)).toEqual([]);
  });

  it('an entity kept in its root\'s table needs no table of its own', async () => {
    const ws = await loadData(changing(complete(), 'entity', (r) => r.id === 'EX-LEND-EN02', { in_root_table: undefined }));
    expect(gaps(ws)).toEqual(['entity-without-table EX-LEND-EN02']);
  });
});

describe("a product's own obligation kinds", () => {
  it('LA-TRC-T06 are designed, built and proved through its design and proof links', async () => {
    const data = adding(complete(), {
      product_kind: [
        { name: 'house_rule', product_id: 'EX', label: 'House rule', description: 'A rule of the house.', parent_kind: 'domain', stage: 'use-cases', obligation: true },
        { name: 'script', product_id: 'EX', label: 'Script', description: 'A script.', parent_kind: 'domain', stage: 'technical-specification', obligation: false },
      ],
      product_kind_field: [{ kind: 'script', position: 1, name: 'file', type: 'text', required: true, description: 'The file.' }],
      product_relation: [
        { name: 'enforces', source_kind: 'script', target_kind: 'house_rule', product_id: 'EX', role: 'design', forward_label: 'Enforces', reverse_label: 'Enforced by', description: 'The script enforces the rule.' },
        { name: 'checks_rule', source_kind: 'use_case_test', target_kind: 'house_rule', product_id: 'EX', role: 'proof', forward_label: 'Checks', reverse_label: 'Checked by', description: 'The test checks the rule.' },
      ],
      house_rule: [
        { id: 'EX-LEND-HR01', title: 'Quiet', domain_id: 'EX-LEND' },
        { id: 'EX-LEND-HR02', title: 'Tidy', domain_id: 'EX-LEND' },
      ],
      script: [{ id: 'EX-LEND-SC01', title: 'quiet.sh', domain_id: 'EX-LEND', file: 'bin/quiet.sh' }],
      enforces: [{ source_id: 'EX-LEND-SC01', target_id: 'EX-LEND-HR01' }],
      checks_rule: [{ source_id: 'EX-LEND-UC01-R01-T01', target_id: 'EX-LEND-HR01' }],
    });
    const ws = await loadData(data);
    expect(obligation(ws, 'EX-LEND', 'house_rule')).toMatchObject({ label: 'House rule', total: 2, designed: 1, built: 1, proved: 1 });
    expect(ws.coverage[0].obligations.at(-1)?.kind).toBe('house_rule');
    expect(obligation(ws, 'EX-LEND', 'script')).toBeUndefined();
  });
});
