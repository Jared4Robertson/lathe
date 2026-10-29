// Coverage: every obligation designed, built and proved, per domain and for what the product shares, and the
// records short of a minimum. Each case starts from the complete product, where everything is covered.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALLOWED_LEVELS, GAP_RULES, type Workspace } from '../src/index.ts';
import { adding, changing, complete, gaps, loadData, obligation, ofCheck, records, removeData, sparse, SPARSE_FILES, without, type Data } from './helpers.ts';

afterAll(removeData);

const covered = (total: number) => ({ total, designed: total, built: total, proved: total, not_automated: 0 });

let clean: Workspace;
beforeAll(async () => {
  clean = await loadData(complete());
});

describe('coverage of the complete product', () => {
  it('LA-TRC-UC02-R01-T01 counts every obligation kind, in kind order, per domain and for what the product shares', () => {
    expect(clean.coverage.map((c) => [c.product, c.domain])).toEqual([['EX', 'EX-LEND'], ['EX', null]]);
    const lending = clean.coverage[0];
    expect(lending.obligations.map((o) => o.kind)).toEqual(['constraint', 'invariant', 'specification', 'policy', 'domain_service', 'uc_requirement', 'pattern_rule', 'view_requirement', 'api_requirement', 'standard_rule']);
    expect(obligation(clean, 'EX-LEND', 'uc_requirement')).toMatchObject({ label: 'UC requirement', proof_only: false, ...covered(2) });
    expect(obligation(clean, 'EX-LEND', 'pattern_rule')).toMatchObject({ proof_only: true, ...covered(1) });
    for (const kind of ['invariant', 'specification', 'policy', 'domain_service', 'api_requirement']) expect(obligation(clean, 'EX-LEND', kind), kind).toMatchObject(covered(1));
    // A constraint and a view requirement follow their value object and view into the one domain that uses them; a
    // standard rule is shared, under its standard.
    for (const kind of ['constraint', 'view_requirement']) {
      expect(obligation(clean, 'EX-LEND', kind), kind).toMatchObject(covered(1));
      expect(obligation(clean, null, kind), kind).toMatchObject({ total: 0 });
    }
    expect(obligation(clean, null, 'standard_rule')).toMatchObject(covered(1));
    expect(obligation(clean, 'EX-LEND', 'standard_rule')).toMatchObject({ total: 0 });
    expect(gaps(clean)).toEqual([]);
  });

  it("LA-TRC-UC02-R08-T01 A constraint counts in its value object's domain, or in Shared when two domains use it", async () => {
    expect(obligation(clean, 'EX-LEND', 'constraint')).toMatchObject(covered(1));
    // A second domain's entity has a field typed by the value object: the product shares it, with its constraint.
    const shared = await loadData(
      adding(complete(), {
        domain: [{ id: 'EX-SHOP', title: 'Shop', product_id: 'EX', subdomain_type: 'supporting', description: 'Selling spare parts.' }],
        aggregate: [{ id: 'EX-SHOP-A1', title: 'Order', domain_id: 'EX-SHOP', identity: 'Order ID', description: 'One order of parts.' }],
        entity: [{ id: 'EX-SHOP-EN01', title: 'Order', aggregate_id: 'EX-SHOP-A1', role: 'root', description: 'The order itself.' }],
        entity_field: [{ entity_id: 'EX-SHOP-EN01', position: 1, name: 'Buyer email', meaning: 'Where the receipt goes.', type_value_object_id: 'EX-VO01', required: true }],
      }),
    );
    expect(obligation(shared, null, 'constraint')).toMatchObject(covered(1));
    expect(obligation(shared, 'EX-LEND', 'constraint')).toMatchObject({ total: 0 });
    expect(obligation(shared, 'EX-SHOP', 'constraint')).toMatchObject({ total: 0 });
  });

  it('LA-TRC-UC06-R02-T01 counts the tests of each scope by state', () => {
    expect(clean.coverage[0].tests).toEqual({ automated: 11, manual: 2, not_automated: 0 });
    // Outside every domain: the standard rule's test.
    expect(clean.coverage[1].tests).toEqual({ automated: 1, manual: 0, not_automated: 0 });
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
    data = without(data, 'fulfills', (r) => r.source_id === 'EX-LEND-UC02-FL01-S01');
    ws = await loadData(data, { missing: ['src/dates.ts'] });
  });

  it('LA-TRC-UC01-R01-T01 a UC requirement is designed once a step fulfills it, a standard rule once a technical record meets it; the rest by construction', () => {
    expect(gaps(ws).filter((g) => g.startsWith('designed'))).toEqual([
      'designed EX-LEND-UC02-R01', // no step fulfills it
      'designed EX-STD-CODE-R01', // no technical record meets it
    ]);
    expect(obligation(ws, 'EX-LEND', 'constraint')).toMatchObject({ total: 1, designed: 1, built: 0, proved: 1 });
  });

  it('LA-TRC-UC01-R04-T01 an obligation is built once the technical record that implements it names a file that exists, counted apart from designed and proved', () => {
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

  it('LA-TRC-UC01-R04-T02 an invariant is built by a data model of its aggregate, or by the table of a unique key naming it', async () => {
    const noModels = without(complete(), 'data_model', (r) => r.entity_id !== 'EX-LEND-EN03');
    const bare = await loadData(noModels);
    expect(gaps(bare)).toEqual(['built EX-LEND-INV01', 'entity-without-data-model EX-LEND-EN01', 'entity-without-data-model EX-LEND-EN02']);
    const key = { table_key: [{ table_id: 'EX-LEND-EN01-TB', position: 2, type: 'unique', columns: ['tool_id'], invariant_id: 'EX-LEND-INV01' }] };
    expect(obligation(await loadData(adding(noModels, key)), 'EX-LEND', 'invariant')).toMatchObject({ designed: 1, built: 1 });
    expect(obligation(await loadData(adding(noModels, key), { missing: ['src/schema.sql'] }), 'EX-LEND', 'invariant')).toMatchObject({ designed: 1, built: 0 });
  });

  it("LA-TRC-UC01-R04-T03 a UC requirement is built through what its steps invoke, or a UI component of the view a step happens in", async () => {
    // UC01-R01 is fulfilled by S01 alone now, which invokes nothing; it still happens in the catalog, which a UI component renders.
    const alone = without(complete(), 'fulfills', (r) => r.source_id === 'EX-LEND-UC01-FL01-S02');
    const viaView = await loadData(without(alone, 'invokes', (r) => r.source_id === 'EX-LEND-UC01-FL01-S01'));
    expect(obligation(viaView, 'EX-LEND', 'uc_requirement')).toMatchObject(covered(2));
    const nowhere = await loadData(without(without(alone, 'invokes', (r) => r.source_id === 'EX-LEND-UC01-FL01-S01'), 'happens_in', (r) => r.source_id === 'EX-LEND-UC01-FL01-S01'));
    expect(gaps(nowhere).filter((g) => !g.startsWith('record-untraced'))).toEqual(['built EX-LEND-UC01-R01']);
    expect(nowhere.coverage[0].gaps.find((g) => g.missing === 'built')).toEqual({ id: 'EX-LEND-UC01-R01', kind: 'uc_requirement', missing: 'built', message: 'UC requirement EX-LEND-UC01-R01 is not built yet: no file of what implements it exists.' });
  });

  it("LA-TRC-UC02-R10-T01 a UC requirement is built by the adapter of an integration its step exchanges with, or a product kind's record under it", async () => {
    // The one step that fulfills UC01-R01 invokes nothing and happens in no view; it exchanges with the mail integration.
    let alone = without(complete(), 'fulfills', (r) => r.source_id === 'EX-LEND-UC01-FL01-S02');
    alone = without(alone, 'invokes', (r) => r.source_id === 'EX-LEND-UC01-FL01-S01');
    alone = without(alone, 'happens_in', (r) => r.source_id === 'EX-LEND-UC01-FL01-S01');
    const exchanging = adding(alone, { exchanges_with: [{ source_id: 'EX-LEND-UC01-FL01-S01', target_id: 'EX-INT01' }] });
    expect(obligation(await loadData(exchanging), 'EX-LEND', 'uc_requirement')).toMatchObject(covered(2));
    // With no adapter, a hook of the product's own kind under the integration carries it out, once its file exists.
    const hooked = adding(without(exchanging, 'adapter', () => true), {
      product_kind: [{ name: 'hook', product_id: 'EX', label: 'Hook', description: 'Code the mail service calls.', parent_kind: 'integration', stage: 'technical-specification', obligation: false }],
      product_kind_field: [{ kind: 'hook', position: 1, name: 'file', type: 'text', required: true, description: 'The file.' }],
      hook: [{ id: 'EX-INT01-HK01', title: 'On bounce', integration_id: 'EX-INT01', file: 'src/bounce.ts' }],
    });
    expect(obligation(await loadData(hooked), 'EX-LEND', 'uc_requirement')).toMatchObject(covered(2));
    expect(gaps(await loadData(hooked, { missing: ['src/bounce.ts'] }))).toContain('built EX-LEND-UC01-R01');
    expect(gaps(await loadData(alone))).toContain('built EX-LEND-UC01-R01');
  });
});

describe('chains', () => {
  const chain = (ws: Workspace, id: string) => ws.chains.find((c) => c.obligation === id)!;

  it("LA-TRC-UC10-R05-T01 each obligation's chain holds what designs it, what builds it as built counts, its tests and their files, link by link", () => {
    // A UC requirement: its fulfilling steps, their flow, the view they happen in, what they invoke and the integration
    // they exchange with; the handlers, the UI component and the adapter that build it; its test.
    const req = chain(clean, 'EX-LEND-UC01-R01');
    expect(new Set(req.design)).toEqual(new Set(['EX-V01', 'EX-INT01', 'EX-LEND-UC01-FL01', 'EX-LEND-UC01-FL01-S01', 'EX-LEND-UC01-FL01-S02', 'EX-LEND-CMD01', 'EX-LEND-QRY01']));
    expect(req.build).toEqual(expect.arrayContaining(['EX-LEND-CMD01-H', 'EX-LEND-QRY01-H', 'EX-UI01']));
    expect(req.tests).toEqual(['EX-LEND-UC01-R01-T01']);
    expect(req.links).toEqual(expect.arrayContaining([
      ['EX-LEND-UC01-R01', 'EX-LEND-UC01-FL01'], ['EX-LEND-UC01-FL01', 'EX-LEND-UC01-FL01-S01'], ['EX-LEND-UC01-FL01-S01', 'EX-LEND-CMD01'],
      ['EX-LEND-CMD01', 'EX-LEND-CMD01-H'], ['EX-V01', 'EX-UI01'], ['EX-LEND-UC01-FL01-S02', 'EX-INT01'], ['EX-LEND-UC01-R01', 'EX-LEND-UC01-R01-T01'],
    ]));
    expect(req.files.find((f) => f.path === 'test/api.test.ts')?.named_by).toEqual(['EX-LEND-UC01-R01-T01']);
    // A policy: its command, then its event handler; a constraint its value object, then its value type.
    expect(chain(clean, 'EX-LEND-PO01')).toMatchObject({ design: ['EX-LEND-CMD03'], build: ['EX-LEND-PO01-H'], tests: ['EX-LEND-PO01-T'] });
    expect(chain(clean, 'EX-VO01-C01').links).toEqual(expect.arrayContaining([['EX-VO01-C01', 'EX-VO01'], ['EX-VO01', 'EX-VO01-VT']]));
    // Every obligation has a chain, and only obligations do.
    expect(clean.chains.map((c) => c.obligation).sort()).toEqual(clean.records.filter((r) => clean.kinds.find((k) => k.kind === r.kind)?.obligation).map((r) => r.id).sort());
  });

  it("LA-TRC-UC10-R05-T02 a flow step, command, query or UI component no obligation's chain reaches is a record-untraced gap", async () => {
    // The complete product: everything is reached, a policy's command through the policy.
    expect(gaps(clean).filter((g) => g.startsWith('record-untraced'))).toEqual([]);
    let data = without(complete(), 'fulfills', (r) => r.source_id === 'EX-LEND-UC01-FL01-S02');
    data = adding(data, {
      command: [{ id: 'EX-LEND-CMD09', title: 'Forget a tool', entity_id: 'EX-LEND-EN01', description: 'Drops a tool from its loans.' }],
      command_handler: [{ id: 'EX-LEND-CMD09-H', title: 'forgetTool', command_id: 'EX-LEND-CMD09', file: 'src/tools.ts', description: 'Deletes the rows in one transaction.' }],
      ui_component: [{ id: 'EX-UI02', title: 'Unused page', file: 'web/catalog.tsx', description: 'A page no view uses.' }],
    });
    const ws = await loadData(data);
    // A step that fulfills nothing, the query only it invokes, a command nothing invokes and a UI component that
    // renders no view; never the handlers, the integration's test or a flow test.
    expect(gaps(ws).filter((g) => g.startsWith('record-untraced'))).toEqual([
      'record-untraced EX-LEND-CMD09', 'record-untraced EX-LEND-QRY01', 'record-untraced EX-LEND-UC01-FL01-S02', 'record-untraced EX-UI02',
    ]);
    expect(ws.coverage.flatMap((c) => c.gaps).find((g) => g.id === 'EX-LEND-UC01-FL01-S02')).toEqual({
      id: 'EX-LEND-UC01-FL01-S02', kind: 'flow_step', missing: 'record-untraced',
      message: "Flow step EX-LEND-UC01-FL01-S02 is untraced: no obligation's chain reaches it, as it fulfills no UC requirement.",
    });
    // It is a gap, never a problem.
    expect(ws.problems.filter((p) => p.record === 'EX-LEND-UC01-FL01-S02')).toEqual([]);
  });
});

describe('proved', () => {
  let ws: Workspace;
  beforeAll(async () => {
    let data = changing(complete(), 'constraint_test', () => true, { level: 'service' });
    data = changing(data, 'specification_test', () => true, { state: 'not automated yet' });
    data = changing(data, 'view_test', () => true, { level: 'browser', state: 'manual', manual_reason: 'Looked at by eye.', file: undefined });
    data = without(data, 'standard_rule_test', () => true);
    ws = await loadData(data, { silent: ['EX-LEND-PO01-T'] });
  });

  it('LA-TRC-UC02-R03-T01 only an automated or manual test at an allowed level, whose file names it, proves', () => {
    expect(gaps(ws)).toEqual(['proved EX-LEND-PO01', 'proved EX-LEND-SP01', 'proved EX-STD-CODE-R01', 'proved EX-VO01-C01']);
    // A manual test proves.
    expect(obligation(ws, 'EX-LEND', 'view_requirement')).toMatchObject(covered(1));
  });

  it('LA-TRC-UC02-R07-T01 a test at a level its kind does not allow proves nothing', () => {
    // The constraint's test runs at api, which a constraint test does not allow.
    expect(obligation(ws, 'EX-LEND', 'constraint')).toMatchObject({ total: 1, proved: 0 });
    expect(ws.coverage.find((c) => c.domain === 'EX-LEND')?.gaps.find((g) => g.id === 'EX-VO01-C01')?.missing).toBe('proved');
  });

  it('LA-TRC-UC01-R02-T02 an automated test whose file does not name it leaves its obligation unproved, listed as a gap', () => {
    expect(ws.coverage[0].gaps.find((g) => g.id === 'EX-LEND-PO01')).toEqual({ id: 'EX-LEND-PO01', kind: 'policy', missing: 'proved', message: 'Policy EX-LEND-PO01 is not proved yet.' });
  });

  it('LA-TRC-UC02-R03-T01 a test not automated yet leaves its obligation unproved, counted and named as such', () => {
    expect(obligation(ws, 'EX-LEND', 'specification')).toMatchObject({ total: 1, proved: 0, not_automated: 1 });
    expect(ws.coverage[0].gaps.find((g) => g.id === 'EX-LEND-SP01')?.message).toBe('Specification EX-LEND-SP01 is not proved yet: its test is not automated yet.');
    expect(ws.coverage[0].tests).toEqual({ automated: 9, manual: 3, not_automated: 1 });
  });

  it('LA-AUT-UC16-R02-T03 a standard rule with no standard rule test is not proved', () => {
    expect(obligation(ws, null, 'standard_rule')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 0 });
  });
});

describe('pattern rules', () => {
  const shop = (data = complete()) =>
    adding(data, {
      domain: [{ id: 'EX-SHOP', title: 'Shop', product_id: 'EX', subdomain_type: 'supporting', description: 'Selling spare parts.' }],
      capability: [{ id: 'EX-SHOP-CAP01', title: 'Selling', domain_id: 'EX-SHOP', position: 1, description: 'Selling tools.' }],
      use_case: [{ id: 'EX-SHOP-UC01', title: 'Sell a tool', capability_id: 'EX-SHOP-CAP01', goal: 'A customer buys a used tool.' }],
    });

  it("LA-TRC-SP04-T each domain that follows a pattern owes its rules, proved only by its own pattern rule test", async () => {
    const data = adding(shop(), {
      follows: [{ source_id: 'EX-SHOP-UC01', target_id: 'EX-PAT-ACT' }],
      setting_value: [{ follower_id: 'EX-SHOP-UC01', pattern_id: 'EX-PAT-ACT', setting: 'record', value: 'Sale' }],
    });
    const ws = await loadData(data);
    expect(obligation(ws, 'EX-LEND', 'pattern_rule')).toMatchObject({ proof_only: true, ...covered(1) });
    expect(obligation(ws, 'EX-SHOP', 'pattern_rule')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 0 });
    expect(ws.coverage.find((c) => c.domain === 'EX-SHOP')?.gaps.find((g) => g.missing === 'proved')?.message).toBe('Pattern rule EX-PAT-ACT-R01 is not proved yet in EX-SHOP.');
  });

  it('LA-TRC-UC04-R02-T01 a domain that does not follow the pattern owes none of its rules', async () => {
    const ws = await loadData(shop());
    expect(obligation(ws, 'EX-SHOP', 'pattern_rule')).toMatchObject({ total: 0 });
  });

  /** The complete product where every following use case marks the rule's setting not applicable. */
  const notApplicable = () => changing(changing(complete(), 'pattern_rule', () => true, { setting: 'record' }), 'setting_value', () => true, { value: undefined, not_applicable: 'Adds nothing.' });

  it('LA-TRC-SP02-T a rule whose setting every following use case marks not applicable is waived there', async () => {
    expect(obligation(await loadData(notApplicable()), 'EX-LEND', 'pattern_rule')).toMatchObject({ total: 0 });
  });

  it('LA-TRC-UC07-R01-T01 a domain that follows the pattern itself owes the rule all the same', async () => {
    const itself = await loadData(adding(notApplicable(), { follows: [{ source_id: 'EX-LEND', target_id: 'EX-PAT-ACT' }] }));
    expect(obligation(itself, 'EX-LEND', 'pattern_rule')).toMatchObject(covered(1));
  });

  it('LA-TRC-SP03-T a rule no follower meets the applies-when setting of is waived in that domain', async () => {
    const when = (value: string, negated = false) => changing(complete(), 'pattern_rule', () => true, { applies_when_setting: 'record', applies_when_value: value, applies_when_negated: negated });
    expect(obligation(await loadData(when(' tool ')), 'EX-LEND', 'pattern_rule')).toMatchObject({ total: 1 });
    expect(obligation(await loadData(when('Loan')), 'EX-LEND', 'pattern_rule')).toMatchObject({ total: 0 });
    expect(obligation(await loadData(when('Loan', true)), 'EX-LEND', 'pattern_rule')).toMatchObject({ total: 1 });
  });
});

describe('LA-TRC-UC01-R05-T01 minimums', () => {
  it('a record short of each minimum is a gap, under its own scope, named by the rule', async () => {
    // A source file no record names, for code-file-untraced, a route no endpoint has, for route-without-record, and a
    // package no record names, for package-not-accounted-for.
    const ws = await loadData(sparse(), { files: { ...SPARSE_FILES.files, 'src/orphan.ts': 'export {};\n', 'package.json': '{ "dependencies": { "left-pad": "^1.3.0" } }\n' } });
    const found = new Set(ws.coverage.flatMap((c) => c.gaps.map((g) => g.missing)));
    for (const rule of GAP_RULES) expect(found.has(rule.name), rule.name).toBe(true);
    // A view's gap is the domain's whose flow step happens in it, as a use case's is its domain's.
    expect(ws.coverage.find((c) => c.domain === 'SP-D')?.gaps).toContainEqual({ id: 'SP-V01', kind: 'view', missing: 'view-without-ui-component', message: 'View SP-V01 is rendered by no UI component.' });
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

  it('LA-AUT-UC12-R07-T01 An aggregate changed only through a recorded exception (command_change) has a command', async () => {
    const lone = adding(complete(), { aggregate: [{ id: 'EX-LEND-A3', title: 'Shelf', domain_id: 'EX-LEND', identity: 'Shelf ID', description: 'A shelf the tools sit on.' }] });
    const ofCommand = (ws: Workspace) => gaps(ws).filter((g) => g.startsWith('aggregate-without-command'));
    expect(ofCommand(await loadData(lone))).toEqual(['aggregate-without-command EX-LEND-A3']);
    const changed = adding(lone, { command_change: [{ command_id: 'EX-LEND-CMD01', aggregate_id: 'EX-LEND-A3', reason: 'Opening a loan takes the tool off its shelf.' }] });
    expect(ofCommand(await loadData(changed))).toEqual([]);
  });

  it('an entity kept in its root\'s table needs no table of its own', async () => {
    const ws = await loadData(changing(complete(), 'entity', (r) => r.id === 'EX-LEND-EN02', { in_root_table: undefined }));
    expect(gaps(ws)).toEqual(['entity-without-table EX-LEND-EN02']);
  });
});

describe("a product's own obligation kinds", () => {
  const houseRules = () =>
    adding(complete(), {
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

  it('LA-TRC-UC02-R02-T01 are designed, built and proved through its design and proof links', async () => {
    const ws = await loadData(houseRules());
    expect(obligation(ws, 'EX-LEND', 'house_rule')).toMatchObject({ label: 'House rule', total: 2, designed: 1, built: 1, proved: 1 });
  });

  it("LA-TRC-UC02-R06-T01 are obligations as the product's kind declares, counted after Lathe's", async () => {
    const ws = await loadData(houseRules());
    expect(ws.kinds.find((k) => k.kind === 'house_rule')?.obligation).toBe(true);
    expect(ws.kinds.find((k) => k.kind === 'script')?.obligation).toBe(false);
    expect(ws.coverage[0].obligations.at(-1)?.kind).toBe('house_rule');
    expect(obligation(ws, 'EX-LEND', 'script')).toBeUndefined();
  });

  it('LA-TRC-UC02-R09-T01 are proved by a product kind that names a file only when the file names it', async () => {
    const data = adding(houseRules(), {
      product_kind: [
        { name: 'rule_check', product_id: 'EX', label: 'Rule check', description: 'A script that checks a rule.', parent_kind: 'domain', stage: 'test-plan', obligation: false },
        { name: 'sign_off', product_id: 'EX', label: 'Sign-off', description: 'A person signing a rule off.', parent_kind: 'domain', stage: 'test-plan', obligation: false },
      ],
      product_kind_field: [{ kind: 'rule_check', position: 1, name: 'file', type: 'text', required: true, description: 'The file that runs it.' }],
      product_relation: [
        { name: 'checks_by_script', source_kind: 'rule_check', target_kind: 'house_rule', product_id: 'EX', role: 'proof', forward_label: 'Checks', reverse_label: 'Checked by', description: 'The script checks the rule.' },
        { name: 'signs_off', source_kind: 'sign_off', target_kind: 'house_rule', product_id: 'EX', role: 'proof', forward_label: 'Signs off', reverse_label: 'Signed off by', description: 'The person signs the rule off.' },
      ],
      house_rule: [{ id: 'EX-LEND-HR03', title: 'Calm', domain_id: 'EX-LEND' }],
      rule_check: [{ id: 'EX-LEND-RC01', title: 'tidy.sh', domain_id: 'EX-LEND', file: 'test/tidy.sh' }],
      sign_off: [{ id: 'EX-LEND-SO01', title: 'Calm signed off', domain_id: 'EX-LEND' }],
      checks_by_script: [{ source_id: 'EX-LEND-RC01', target_id: 'EX-LEND-HR02' }],
      signs_off: [{ source_id: 'EX-LEND-SO01', target_id: 'EX-LEND-HR03' }],
    });
    // HR01 by a use case test, HR02 by the script whose file names it, HR03 by a sign-off that names no file.
    expect(obligation(await loadData(data), 'EX-LEND', 'house_rule')).toMatchObject({ total: 3, proved: 3 });
    // The script's file exists but leaves its ID out, so it no longer proves HR02; the sign-off still counts.
    expect(obligation(await loadData(data, { silent: ['EX-LEND-RC01'] }), 'EX-LEND', 'house_rule')).toMatchObject({ total: 3, proved: 2 });
  });
});

describe('pattern rules, domain by domain', () => {
  const shop = (data = complete()) =>
    adding(data, {
      domain: [{ id: 'EX-SHOP', title: 'Shop', product_id: 'EX', subdomain_type: 'supporting', description: 'Selling spare parts.' }],
      capability: [{ id: 'EX-SHOP-CAP01', title: 'Selling', domain_id: 'EX-SHOP', position: 1, description: 'Selling tools.' }],
      use_case: [
        { id: 'EX-SHOP-UC01', title: 'Sell a tool', capability_id: 'EX-SHOP-CAP01', goal: 'A customer buys a used tool.' },
        { id: 'EX-SHOP-UC02', title: 'Price a tool', capability_id: 'EX-SHOP-CAP01', goal: 'The clerk sets the price of a used tool.' },
      ],
    });
  /** A second pattern of the complete product, with no settings and one rule. */
  const logged = (data = complete()) =>
    adding(data, {
      pattern: [{ id: 'EX-PAT-LOG', title: 'Logged action', product_id: 'EX', description: 'An action written to the log.' }],
      pattern_rule: [{ id: 'EX-PAT-LOG-R01', title: 'Each action is logged', pattern_id: 'EX-PAT-LOG', statement: 'Each action MUST be logged.' }],
    });
  /** A follower of EX-PAT-ACT with its value of record, or with record not applicable (null). */
  const sale = (follower: string, value: string | null): Data => ({
    follows: [{ source_id: follower, target_id: 'EX-PAT-ACT' }],
    setting_value: [
      value === null
        ? { follower_id: follower, pattern_id: 'EX-PAT-ACT', setting: 'record', not_applicable: 'Saves nothing.' }
        : { follower_id: follower, pattern_id: 'EX-PAT-ACT', setting: 'record', value },
    ],
  });
  const merge = (...parts: Data[]) => parts.reduce((all, part) => adding(all, part), {} as Data);

  it('LA-TRC-UC04-R01-T01 a pattern rule sits under a pattern and is an obligation counted for proof alone', async () => {
    expect(clean.kinds.find((k) => k.kind === 'pattern_rule')).toMatchObject({ obligation: true });
    const ws = await loadData(without(complete(), 'pattern_rule_test', () => true));
    // Nothing designs or builds a pattern rule, and it is still designed and built: only its proof is missing.
    expect(obligation(ws, 'EX-LEND', 'pattern_rule')).toMatchObject({ proof_only: true, total: 1, designed: 1, built: 1, proved: 0 });
    expect(gaps(ws)).toEqual(['proved EX-PAT-ACT-R01']);
  });

  it("LA-TRC-UC04-R03-T01 a domain's own pattern rule test proves the rule there and nowhere else; one not automated yet leaves it not automated", async () => {
    const data = adding(shop(), sale('EX-SHOP-UC01', 'Sale'));
    const ws = await loadData(data);
    expect(obligation(ws, 'EX-LEND', 'pattern_rule')).toMatchObject(covered(1));
    expect(obligation(ws, 'EX-SHOP', 'pattern_rule')).toMatchObject({ total: 1, proved: 0, not_automated: 0 });
    const planned = adding(data, { pattern_rule_test: [{ id: 'EX-PAT-ACT-R01-T02', title: 'A sale reads the same', pattern_rule_id: 'EX-PAT-ACT-R01', domain_id: 'EX-SHOP', level: 'service', state: 'not automated yet', when: 'The clerk saves a sale.', then: 'The sale reads the same everywhere.' }] });
    expect(obligation(await loadData(planned), 'EX-SHOP', 'pattern_rule')).toMatchObject({ total: 1, proved: 0, not_automated: 1 });
  });

  it('LA-TRC-UC04-R04-T01 a rule is not counted where every following use case marks its setting not applicable; one value, or no setting, counts it', async () => {
    const withSetting = changing(shop(logged()), 'pattern_rule', (r) => r.id === 'EX-PAT-ACT-R01', { setting: 'record' });
    const following: Data = { follows: [{ source_id: 'EX-SHOP-UC01', target_id: 'EX-PAT-LOG' }] };
    const none = await loadData(adding(withSetting, merge(sale('EX-SHOP-UC01', null), sale('EX-SHOP-UC02', null), following)));
    expect(obligation(none, 'EX-SHOP', 'pattern_rule')).toMatchObject({ total: 1 });
    expect(none.coverage.find((c) => c.domain === 'EX-SHOP')?.gaps.filter((g) => g.kind === 'pattern_rule').map((g) => g.id)).toEqual(['EX-PAT-LOG-R01']);
    const one = await loadData(adding(withSetting, merge(sale('EX-SHOP-UC01', null), sale('EX-SHOP-UC02', 'Price'), following)));
    expect(obligation(one, 'EX-SHOP', 'pattern_rule')).toMatchObject({ total: 2 });
  });

  it('LA-TRC-UC04-R05-T01 a not-proved warning names the pattern rule and each domain that owes it, and says when its test there is not automated yet', async () => {
    const data = adding(shop(), merge(sale('EX-SHOP-UC01', 'Sale'), sale('EX-SHOP', 'Sale')));
    const unproved = without(data, 'pattern_rule_test', () => true);
    expect(ofCheck(await loadData(unproved), 'not-proved').map((p) => p.message)).toEqual([
      'Pattern rule EX-PAT-ACT-R01 is not proved yet in EX-LEND.',
      'Pattern rule EX-PAT-ACT-R01 is not proved yet in EX-SHOP.',
    ]);
    const planned = changing(data, 'pattern_rule_test', () => true, { state: 'not automated yet', file: undefined });
    expect(ofCheck(await loadData(planned), 'not-proved').map((p) => p.message)).toEqual([
      'Pattern rule EX-PAT-ACT-R01 is not proved yet in EX-LEND: its test is not automated yet.',
      'Pattern rule EX-PAT-ACT-R01 is not proved yet in EX-SHOP.',
    ]);
  });

  it("LA-TRC-UC04-R08-T01 an obligation outside every domain counts in the product's Shared coverage, and a pattern rule never does", async () => {
    const data = adding(complete(), {
      product_kind: [{ name: 'house_rule', product_id: 'EX', label: 'House rule', description: 'A rule of the house.', parent_kind: 'product', stage: 'use-cases', obligation: true }],
      house_rule: [{ id: 'EX-HR01', title: 'Quiet', product_id: 'EX' }],
    });
    const ws = await loadData(data);
    expect(obligation(ws, null, 'house_rule')).toMatchObject({ total: 1, proved: 0 });
    expect(obligation(ws, null, 'pattern_rule')).toMatchObject({ total: 0 });
    expect(records(ofCheck(ws, 'not-proved'))).toEqual(['EX-HR01']);
  });

  it('LA-TRC-UC04-R09-T01 a waived rule adds nothing to its domain: no count, no gap, no not-proved warning, and its test there counts nothing', async () => {
    const waived = changing(complete(), 'pattern_rule', () => true, { applies_when_setting: 'record', applies_when_value: 'Loan', applies_when_negated: false });
    const ws = await loadData(waived);
    expect(obligation(ws, 'EX-LEND', 'pattern_rule')).toMatchObject({ total: 0, proved: 0 });
    expect(gaps(ws)).toEqual([]);
    expect(ofCheck(ws, 'not-proved')).toEqual([]);
    expect(ofCheck(ws, 'pattern-rule-test-outside-followers').map((p) => p.severity)).toEqual(['warning']);
  });

  it('LA-TRC-SP01-T a domain follows a pattern itself or through any of its use cases', async () => {
    // EX-LEND follows EX-PAT-ACT through its use case, and EX-PAT-LOG itself.
    const ws = await loadData(adding(logged(), { follows: [{ source_id: 'EX-LEND', target_id: 'EX-PAT-LOG' }] }));
    expect(obligation(ws, 'EX-LEND', 'pattern_rule')).toMatchObject({ total: 2, proved: 1 });
    expect(ws.coverage.find((c) => c.domain === 'EX-LEND')?.gaps.map((g) => g.id)).toEqual(['EX-PAT-LOG-R01']);
  });

  it('LA-TRC-UC07-R02-T01 a domain following a pattern itself and through a use case counts each rule once; one following only through use cases that all mark the setting not applicable counts none', async () => {
    const both = await loadData(adding(complete(), { follows: [{ source_id: 'EX-LEND', target_id: 'EX-PAT-ACT' }] }));
    expect(obligation(both, 'EX-LEND', 'pattern_rule')).toMatchObject(covered(1));
    const withSetting = changing(shop(), 'pattern_rule', () => true, { setting: 'record' });
    const none = await loadData(adding(withSetting, merge(sale('EX-SHOP-UC01', null), sale('EX-SHOP-UC02', null))));
    expect(obligation(none, 'EX-SHOP', 'pattern_rule')).toMatchObject({ total: 0 });
    expect(none.coverage.find((c) => c.domain === 'EX-SHOP')?.gaps.filter((g) => g.kind === 'pattern_rule')).toEqual([]);
  });

  it('LA-TRC-UC07-R03-T01 a pattern may have no settings: its followers give none, and its rules are owed wherever it is followed', async () => {
    const data = adding(logged(), { follows: [{ source_id: 'EX-LEND-UC01', target_id: 'EX-PAT-LOG' }, { source_id: 'EX-LEND', target_id: 'EX-PAT-LOG' }] });
    const ws = await loadData(data);
    expect(ofCheck(ws, 'pattern-setting-missing')).toEqual([]);
    expect(obligation(ws, 'EX-LEND', 'pattern_rule')).toMatchObject({ total: 2, proved: 1 });
  });

  it('LA-TRC-INV02-T a follower of two patterns with a setting of the same name gives each its own value', async () => {
    const data = adding(complete(), {
      pattern: [{ id: 'EX-PAT-AUD', title: 'Audited action', product_id: 'EX', description: 'An action the audit log records.' }],
      pattern_setting: [{ pattern_id: 'EX-PAT-AUD', position: 1, name: 'record', meaning: 'The record audited.' }],
      pattern_rule: [{ id: 'EX-PAT-AUD-R01', title: 'Each change is audited', pattern_id: 'EX-PAT-AUD', statement: 'Each change MUST be audited.' }],
      follows: [{ source_id: 'EX-LEND-UC02', target_id: 'EX-PAT-AUD' }],
    });
    // EX-LEND-UC02's value of record answers EX-PAT-ACT alone.
    expect(ofCheck(await loadData(data), 'pattern-setting-missing')).toEqual([
      expect.objectContaining({ severity: 'error', record: 'EX-LEND-UC02', message: expect.stringContaining('follows pattern EX-PAT-AUD') }),
    ]);
    const answered = adding(data, { setting_value: [{ follower_id: 'EX-LEND-UC02', pattern_id: 'EX-PAT-AUD', setting: 'record', value: 'Tool' }] });
    expect(ofCheck(await loadData(answered), 'pattern-setting-missing')).toEqual([]);
  });

  it('LA-TRC-UC07-R07-T01 a use case that follows a pattern is not asked for requirements of its own', async () => {
    const ws = await loadData(adding(shop(), sale('EX-SHOP-UC01', 'Sale')));
    const gapsOf = (id: string) => ws.coverage.flatMap((c) => c.gaps).filter((g) => g.id === id).map((g) => g.missing);
    expect(gapsOf('EX-SHOP-UC01')).not.toContain('use-case-without-requirement');
    expect(gapsOf('EX-SHOP-UC02')).toContain('use-case-without-requirement');
  });
});

describe('the other obligation kinds and their gaps', () => {
  it('LA-CHK-UC04-R02-T01 a use case with no flow is a use-case-without-flow gap in its domain, never an error', async () => {
    const data = adding(complete(), {
      use_case: [{ id: 'EX-LEND-UC03', title: 'Renew a loan', capability_id: 'EX-LEND-CAP01', goal: 'A member keeps a tool longer.' }],
      use_case_actor: [{ use_case_id: 'EX-LEND-UC03', position: 1, role_name: 'Member' }],
    });
    const ws = await loadData(data);
    expect(ws.coverage.find((c) => c.domain === 'EX-LEND')?.gaps.filter((g) => g.id === 'EX-LEND-UC03').map((g) => g.missing)).toContain('use-case-without-flow');
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });

  it("LA-TRC-UC07-R04-T01 a product kind declared an obligation is counted as Lathe's are, and one that is not is not counted", async () => {
    const data = adding(complete(), {
      product_kind: [
        { name: 'house_rule', product_id: 'EX', label: 'House rule', description: 'A rule of the house.', parent_kind: 'domain', stage: 'use-cases', obligation: true },
        { name: 'house_note', product_id: 'EX', label: 'House note', description: 'A note of the house.', parent_kind: 'domain', stage: 'use-cases', obligation: false },
      ],
      house_rule: [{ id: 'EX-LEND-HR01', title: 'Quiet', domain_id: 'EX-LEND' }],
      house_note: [{ id: 'EX-LEND-HN01', title: 'Tea at four', domain_id: 'EX-LEND' }],
    });
    const ws = await loadData(data);
    expect(obligation(ws, 'EX-LEND', 'house_rule')).toMatchObject({ total: 1, designed: 0, built: 0, proved: 0 });
    expect(obligation(ws, 'EX-LEND', 'house_note')).toBeUndefined();
    expect(records(ofCheck(ws, 'not-proved'))).toEqual(['EX-LEND-HR01']);
  });
});

describe('the run by levels', () => {
  it('LA-TRC-DS02-T01 each test kind allows its own levels, and a pattern rule test or a standard rule test any', () => {
    expect(ALLOWED_LEVELS).toEqual({
      constraint_test: ['unit', 'integration'],
      invariant_test: ['unit', 'integration'],
      specification_test: ['unit', 'integration'],
      policy_test: ['integration', 'service', 'system', 'browser'],
      domain_service_test: ['unit'],
      use_case_test: ['service', 'system', 'browser'],
      view_test: ['unit', 'browser'],
      endpoint_test: ['service', 'system'],
      flow_test: ['system', 'browser'],
      integration_test: ['integration', 'service', 'system'],
      pattern_rule_test: ['unit', 'integration', 'service', 'system', 'browser'],
      standard_rule_test: ['unit', 'integration', 'service', 'system', 'browser'],
    });
  });
});
