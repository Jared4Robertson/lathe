// Lathe's checks of the Checking domain, one at a time: each starts from the complete product, which gives no
// problem, and changes one thing to break the rule. LA-PAT-AGGREGATE-TESTS-R04: each of the domain's check rows is tested here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../../src/index.ts';
import { adding, changing, complete, gaps, loadData, ofCheck, records, removeData, without } from '../helpers.ts';

afterAll(removeData);

/** A check row's tests, under its name. */
const check = (name: string, body: () => void) => describe(name, body);

describe("Lathe's checks", () => {
  it('LA-CHK-UC01-R06-T01 every problem names its check and, when it has one, its record', async () => {
    let data = without(complete(), 'presents', () => true);
    data = changing(data, 'specification_test', () => true, { state: 'not automated yet' });
    const ws = await loadData(data, { silent: ['EX-LEND-INV01-T'], missing: ['src/dates.ts'] });
    expect(new Set(ws.problems.map((p) => p.check)).size).toBeGreaterThan(3);
    for (const problem of ws.problems) {
      expect(problem.check).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(problem.message, problem.check).toMatch(/\.$/);
      if (problem.record !== null) expect(problem.message, problem.check).toContain(problem.record);
    }
  });
});

check('test-level-not-allowed', () => {
  it('LA-CHK-UC01-R09-T01 a test at a level its kind does not allow is a warning naming the allowed levels', async () => {
    let data = changing(complete(), 'constraint_test', () => true, { level: 'service' });
    data = changing(data, 'flow_test', (r) => r.id === 'EX-LEND-UC01-FL-T', { level: 'service' });
    const ws = await loadData(data);
    expect(ofCheck(ws, 'test-level-not-allowed').map((p) => p.message)).toEqual([
      'Flow test EX-LEND-UC01-FL-T runs at level service, which a flow test does not allow; run it at system, browser.',
      'Constraint test EX-VO01-C01-T runs at level service, which a constraint test does not allow; run it at unit, integration.',
    ]);
    // A constraint enforced by a SQL CHECK is tested at integration level, against the database, which a constraint test allows.
    expect(ofCheck(await loadData(changing(complete(), 'constraint_test', () => true, { level: 'integration' })), 'test-level-not-allowed')).toEqual([]);
  });

  it('LA-CHK-UC01-R09-T03 a use case test below service level supports a requirement that a test at an allowed level proves', async () => {
    const unit = { id: 'EX-LEND-UC01-R01-T02', title: 'A lent tool is refused in the loan rules', uc_requirement_id: 'EX-LEND-UC01-R01', level: 'unit', state: 'automated', file: 'test/loans.test.ts', when: 'Borrows a tool on loan', then: 'Expects a refusal' };
    const supported = await loadData(adding(complete(), { use_case_test: [unit] }));
    expect(ofCheck(supported, 'test-level-not-allowed')).toEqual([]);
    expect(gaps(supported)).not.toContain('proved EX-LEND-UC01-R01');
    // The service test is not proof yet, so the unit test stands alone and is reported.
    const unproved = await loadData(changing(adding(complete(), { use_case_test: [unit] }), 'use_case_test', (r) => r.id === 'EX-LEND-UC01-R01-T01', { state: 'not automated yet' }));
    expect(records(ofCheck(unproved, 'test-level-not-allowed'))).toEqual(['EX-LEND-UC01-R01-T02']);
    // A test below service level proves nothing: with only such tests, each is reported and the requirement is not proved.
    const alone = await loadData(changing(adding(complete(), { use_case_test: [unit] }), 'use_case_test', (r) => r.id === 'EX-LEND-UC01-R01-T01', { level: 'unit' }));
    expect(records(ofCheck(alone, 'test-level-not-allowed'))).toEqual(['EX-LEND-UC01-R01-T01', 'EX-LEND-UC01-R01-T02']);
    expect(gaps(alone)).toContain('proved EX-LEND-UC01-R01');
  });

  it('LA-CHK-UC01-R09-T01 a pattern rule test may run at any level', async () => {
    for (const level of ['unit', 'integration', 'service', 'system', 'browser']) {
      const ws = await loadData(changing(complete(), 'pattern_rule_test', () => true, { level }));
      expect(ofCheck(ws, 'test-level-not-allowed'), level).toEqual([]);
    }
  });
});

check('package-not-in-manifest', () => {
  it('LA-TRC-UC19-R02-T02 a record that names a package no package.json lists is an error; one a manifest lists is not', async () => {
    const data = adding(complete(), { package_use: [{ record_id: 'EX-INT01-AD', package: 'nodemailer' }, { record_id: 'EX-INT01-AD', package: 'left-pad' }] });
    const ws = await loadData(data, { files: { 'package.json': '{ "dependencies": { "nodemailer": "^7.0.0" } }\n' } });
    expect(ofCheck(ws, 'package-not-in-manifest')).toEqual([
      { severity: 'error', check: 'package-not-in-manifest', record: 'EX-INT01-AD', message: 'Adapter EX-INT01-AD names package left-pad, which no package.json of its product lists.' },
    ]);
  });
});

describe('nothing uses it', () => {
  let ws: Workspace;
  beforeAll(async () => {
    let data = without(complete(), 'presents', () => true);
    data = without(data, 'exchanges_with', () => true);
    data = without(data, 'checks', () => true);
    data = without(data, 'renders', () => true);
    data = without(data, 'starts_from', () => true);
    data = changing(data, 'entity_field', (r) => r.type_value_object_id === 'EX-VO01', { type_value_object_id: undefined, type: 'text' });
    ws = await loadData(data);
  });
  const unused: [string, string, string][] = [
    ['view-unused', 'EX-V01', 'View EX-V01 presents no command or query; link what a person sends or asks in it with presents, or remove it.'],
    ['integration-unused', 'EX-INT01', 'Integration EX-INT01 is used by nothing: no flow step or policy exchanges with it and it provides nothing; link the steps or policies that exchange with it with exchanges_with, name it the provider of what it provides, or remove it.'],
    ['value-object-unused', 'EX-VO01', 'Value object EX-VO01 is used by nothing: fields of entities, value objects, events or read models are typed with it; type the fields that hold it with it, or remove it.'],
    ['specification-unused', 'EX-LEND-SP01', 'Specification EX-LEND-SP01 is used by nothing: commands check it and queries select by it; link the commands that check it or the queries that select by it, or remove it.'],
    ['test-data-set-unused', 'EX-LEND-TD01', 'Test data set EX-LEND-TD01 is used by nothing: tests start from it; link the tests that start from it with starts_from, or remove it.'],
    ['ui-component-unused', 'EX-UI01', 'UI component EX-UI01 is used by nothing: it renders views; link the views it renders with renders, or remove it.'],
  ];
  for (const [name, record, message] of unused) {
    check(name, () => {
      it(`LA-MOD-UC53-R01-T01 LA-MOD-UC46-R01-T01 LA-IXD-UC28-R01-T01 a record that nothing uses is a ${name} error`, () => {
        expect(ofCheck(ws, name)).toEqual([{ severity: 'error', check: name, record, message }]);
      });
    });
  }

  it('LA-MOD-UC53-R01-T02 a value object used by a read model is used; a query selecting by a specification uses it', async () => {
    let data = changing(complete(), 'entity_field', (r) => r.type_value_object_id === 'EX-VO01', { type_value_object_id: undefined, type: 'text' });
    data = adding(data, { read_model_field: [{ read_model_id: 'EX-LEND-RM01', position: 2, name: 'Email', meaning: 'Whom to tell.', type_value_object_id: 'EX-VO01', required: false }] });
    data = without(data, 'checks', () => true);
    data = adding(data, { selects_by: [{ source_id: 'EX-LEND-QRY01', target_id: 'EX-LEND-SP01' }] });
    const used = await loadData(data);
    expect(used.problems.filter((p) => p.check.endsWith('-unused'))).toEqual([]);
  });
});

check('event-not-by-outbox', () => {
  it('LA-MOD-UC54-R01-T01 an event a policy hears not delivered by outbox is a warning; one that only feeds read models, published or not, may go in process', async () => {
    let data = changing(complete(), 'event_type', (r) => r.id === 'EX-LEND-EV01-ET', { delivery: 'in process' });
    data = changing(data, 'domain_event', (r) => r.id === 'EX-LEND-EV02', { published: true });
    data = adding(data, { fed_by: [{ source_id: 'EX-LEND-RM01', target_id: 'EX-LEND-EV02' }] });
    const ws = await loadData(data);
    expect(ofCheck(ws, 'event-not-by-outbox').map((p) => p.message)).toEqual([
      'Domain event EX-LEND-EV01 is heard by policy EX-LEND-PO01, but its event type EX-LEND-EV01-ET is delivered in process; deliver it by outbox.',
    ]);
  });

  it('LA-MOD-UC54-R01-T01 an event a policy hears with no event type, or whose event type gives no delivery, is reported too', async () => {
    const untyped = without(complete(), 'event_type', (r) => r.id === 'EX-LEND-EV01-ET');
    expect(ofCheck(await loadData(untyped), 'event-not-by-outbox').map((p) => p.message)).toEqual([
      'Domain event EX-LEND-EV01 is heard by policy EX-LEND-PO01, but has no event type; give it one delivered by outbox.',
    ]);
    const undelivered = changing(complete(), 'event_type', () => true, { delivery: undefined });
    expect(ofCheck(await loadData(undelivered), 'event-not-by-outbox').map((p) => p.message)).toEqual([
      'Domain event EX-LEND-EV01 is heard by policy EX-LEND-PO01, but its event type EX-LEND-EV01-ET gives no delivery; deliver it by outbox.',
    ]);
  });

  it('LA-MOD-UC54-R01-T01 the rule reads an event a policy hears only when its aggregate is stored in a database table, not in browser storage, a file or memory', async () => {
    let data = changing(complete(), 'event_type', (r) => r.id === 'EX-LEND-EV01-ET', { delivery: 'in process' });
    data = without(data, 'table_key', (r) => r.table_id === 'EX-LEND-EN01-TB' || r.target_table_id === 'EX-LEND-EN01-TB');
    expect(ofCheck(await loadData(without(without(data, 'stored_in', (r) => r.source_id === 'EX-LEND-EN01-TB'), 'table', (r) => r.id === 'EX-LEND-EN01-TB')), 'event-not-by-outbox')).toEqual([]);
    for (const storage of ['browser storage', 'file', 'in memory']) {
      const kept = changing(data, 'table', (r) => r.id === 'EX-LEND-EN01-TB', { storage });
      expect(ofCheck(await loadData(kept), 'event-not-by-outbox'), storage).toEqual([]);
    }
  });
});

// A product's own kind with a group_name field, its records under domain EX-LEND in the groups given, under a
// max_children of 2.
const houseRules = (groups: string[]) =>
  adding(complete(), {
    product_setting: [{ product_id: 'EX', max_children: 2, max_entities_per_aggregate: 7, technology_words: [] }],
    product_kind: [{ name: 'house_rule', product_id: 'EX', label: 'House rule', description: 'A rule of the house.', parent_kind: 'domain', stage: 'use-cases', obligation: false, complexity: 'essential' }],
    product_kind_field: [{ kind: 'house_rule', position: 1, name: 'group_name', type: 'text', required: false, description: 'Its heading.' }],
    house_rule: groups.map((group_name, i) => ({ id: `EX-LEND-HR${String(i + 1).padStart(2, '0')}`, title: `Rule ${i}`, domain_id: 'EX-LEND', group_name })),
  });

check('too-many-children', () => {
  const requirements = (n: number, group?: (i: number) => string) =>
    Array.from({ length: n }, (_, i) => ({ id: `EX-LEND-UC01-R${String(i + 2).padStart(2, '0')}`, title: `Rule ${i}`, use_case_id: 'EX-LEND-UC01', statement: 'It MUST hold.', ...(group ? { group_name: group(i) } : {}) }));

  it('LA-CHK-UC06-R01-T01 a record with more children of one kind than max_children is a warning naming the parent, kind and count', async () => {
    const ws = await loadData(adding(complete(), { product_setting: [{ product_id: 'EX', max_children: 3, max_entities_per_aggregate: 7, technology_words: [] }], uc_requirement: requirements(3) }));
    expect(ofCheck(ws, 'too-many-children')).toEqual([
      expect.objectContaining({ severity: 'warning', record: 'EX-LEND-UC01', message: expect.stringContaining('Use case EX-LEND-UC01 has 4 children of kind uc_requirement, more than the 3') }),
    ]);
  });

  it('LA-CHK-UC06-R02-T01 without the setting the limit is 15', async () => {
    const ws = await loadData(adding(complete(), { uc_requirement: requirements(15) }));
    expect(ofCheck(ws, 'too-many-children').map((p) => p.message)).toEqual([expect.stringContaining('has 16 children of kind uc_requirement, more than the 15')]);
  });

  it('LA-CHK-UC06-R01-T04 tests are never counted, however many a record holds', async () => {
    const tests = Array.from({ length: 20 }, (_, i) => ({ id: `EX-LEND-UC01-R01-T${String(i + 2).padStart(2, '0')}`, title: `Test ${i}`, uc_requirement_id: 'EX-LEND-UC01-R01', level: 'service', state: 'not automated yet', when: 'A member asks for a tool on loan.', then: 'The library refuses.' }));
    const ws = await loadData(adding(complete(), { use_case_test: tests }));
    expect(ofCheck(ws, 'too-many-children')).toEqual([]);
  });

  it("LA-CHK-UC06-R05-T01 a flow's steps are counted per path, named when not main", async () => {
    const steps = (path: string, n: number, from: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `EX-LEND-UC01-FL-S${String(from + i).padStart(2, '0')}`, title: `Step ${from + i}`, flow_id: 'EX-LEND-UC01-FL', path, position: i + 1 + (path === 'main' ? 2 : 0) }));
    const limit = { product_setting: [{ product_id: 'EX', max_children: 3, max_entities_per_aggregate: 7, technology_words: [] }] };
    const even = adding(complete(), { ...limit, flow_step: [...steps('main', 1, 3), ...steps('refused', 3, 4)] });
    expect(ofCheck(await loadData(even), 'too-many-children')).toEqual([]);
    const over = adding(complete(), { ...limit, flow_step: [...steps('main', 1, 3), ...steps('refused', 4, 4)] });
    expect(ofCheck(await loadData(over), 'too-many-children').map((p) => p.message)).toEqual([
      expect.stringContaining('Flow EX-LEND-UC01-FL has 4 children of kind flow_step on path refused, more than the 3'),
    ]);
  });

  it('LA-CHK-UC06-R06-T01 grouped requirements are counted per group, groups compared in any letter case', async () => {
    const ws = await loadData(adding(complete(), { product_setting: [{ product_id: 'EX', max_children: 2, max_entities_per_aggregate: 7, technology_words: [] }], uc_requirement: requirements(4, (i) => (i < 3 ? (i ? 'Limits' : 'limits ') : 'Other')) }));
    expect(ofCheck(ws, 'too-many-children').map((p) => p.message)).toEqual([expect.stringContaining('has 3 children of kind uc_requirement in group Limits')]);
  });

  it('LA-CHK-UC06-R06-T03 a domain\'s use cases are counted per aggregate or read model they sit with, and the warning says to split it', async () => {
    const limit = { product_setting: [{ product_id: 'EX', max_children: 2, max_entities_per_aggregate: 7, technology_words: [] }] };
    // Two use cases sit with the Loan (EX-LEND-A1), one with the Tool, one with the Free tools read model: four in the domain, none over 2.
    const loan = { id: 'EX-LEND-UC03', title: 'Remind the borrower', domain_id: 'EX-LEND', goal: 'The librarian reminds a borrower of the due date.', result_id: 'EX-LEND-CMD03' };
    const free = { id: 'EX-LEND-UC04', title: 'See the free tools', domain_id: 'EX-LEND', goal: 'A member sees which tools are free.', result_id: 'EX-LEND-QRY01' };
    expect(ofCheck(await loadData(adding(complete(), { ...limit, use_case: [loan, free] })), 'too-many-children')).toEqual([]);
    const third = { id: 'EX-LEND-UC05', title: 'Remind every borrower', domain_id: 'EX-LEND', goal: 'The librarian reminds each borrower of a loan due.', result_id: 'EX-LEND-CMD03' };
    expect(ofCheck(await loadData(adding(complete(), { ...limit, use_case: [loan, free, third], use_case_actor: [{ use_case_id: 'EX-LEND-UC05', position: 1, role_name: 'Librarian' }] })), 'too-many-children')).toEqual([
      expect.objectContaining({
        severity: 'warning', record: 'EX-LEND',
        message: "Domain EX-LEND has 3 children of kind use_case sitting with EX-LEND-A1, more than the 2 that the product's max_children setting allows; split the aggregate or read model they sit with.",
      }),
    ]);
  });

  it("LA-CHK-UC06-R06-T02 a product kind's records are counted per group_name", async () => {
    const under = ['Noise', 'Noise', 'Tools', 'tools '];
    expect(ofCheck(await loadData(houseRules(under)), 'too-many-children')).toEqual([]);
    expect(ofCheck(await loadData(houseRules([...under, 'Yard', 'Yard', 'Yard'])), 'too-many-children').map((p) => p.message)).toEqual([
      expect.stringContaining('Domain EX-LEND has 3 children of kind house_rule in group Yard, more than the 2'),
    ]);
  });
});

check('aggregate-too-large', () => {
  // Child entities of the loan (EX-LEND-A1, which holds the Loan and its Return), stored in its root's table.
  const children = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `EX-LEND-EN${String(i + 10).padStart(2, '0')}`, title: `Part ${i}`, aggregate_id: 'EX-LEND-A1', role: 'child', in_root_table: true, description: 'A part of the loan.' }));

  describe('LA-STD-MODELING-R01-T01 aggregates are small', () => {
    it('LA-CHK-UC06-R08-T01 an aggregate with more entities than max_entities_per_aggregate is a warning naming it, the count and the limit', async () => {
      const at = (n: number) => adding(complete(), { product_setting: [{ product_id: 'EX', max_children: 15, max_entities_per_aggregate: 3, technology_words: [] }], entity: children(n) });
      expect(ofCheck(await loadData(at(1)), 'aggregate-too-large')).toEqual([]);
      expect(ofCheck(await loadData(at(2)), 'aggregate-too-large')).toEqual([
        {
          severity: 'warning', check: 'aggregate-too-large', record: 'EX-LEND-A1',
          message: "Aggregate EX-LEND-A1 has 4 entities, more than the 3 that the product's max_entities_per_aggregate setting allows; split it into smaller aggregates that each change together.",
        },
      ]);
    });
  });

  it('LA-CHK-UC06-R09-T01 without the setting the limit is 7', async () => {
    expect(ofCheck(await loadData(adding(complete(), { entity: children(5) })), 'aggregate-too-large')).toEqual([]);
    expect(ofCheck(await loadData(adding(complete(), { entity: children(6) })), 'aggregate-too-large').map((p) => p.message)).toEqual([
      expect.stringContaining('Aggregate EX-LEND-A1 has 8 entities, more than the 7'),
    ]);
  });
});

check('lone-child', () => {
  it("LA-CHK-UC06-R03-T01 an aggregate or read model with one use case is not a lone child, nor is a flow's path with one step", async () => {
    // Each of the complete product's two use cases sits alone with its aggregate (Loan, Tool); each flow has one main step at least.
    expect(ofCheck(await loadData(complete()), 'lone-child')).toEqual([]);
    const asking = adding(complete(), {
      use_case: [{ id: 'EX-LEND-UC03', title: 'See the free tools', domain_id: 'EX-LEND', goal: 'A member sees which tools are free.', result_id: 'EX-LEND-QRY01' }],
      flow_step: [{ id: 'EX-LEND-UC01-FL-S03', title: 'Tool is on loan', flow_id: 'EX-LEND-UC01-FL', path: 'refused', position: 1 }],
    });
    expect(ofCheck(await loadData(asking), 'lone-child')).toEqual([]);
  });

  it("LA-CHK-UC06-R04-T01 a group's members are counted among their parent's children of one kind; a group of two, and children with no group, are not reported", async () => {
    const grouped = (groups: (string | undefined)[]) =>
      adding(complete(), { uc_requirement: groups.map((group_name, i) => ({ id: `EX-LEND-UC01-R0${i + 2}`, title: `Limit ${i + 2}`, use_case_id: 'EX-LEND-UC01', statement: 'The library MUST hold to it.', ...(group_name ? { group_name } : {}) })) });
    expect(ofCheck(await loadData(grouped(['Limits', 'limits ', undefined])), 'lone-child')).toEqual([]);
    expect(ofCheck(await loadData(grouped(['Limits', 'limits ', 'Fees'])), 'lone-child').map((p) => p.message)).toEqual([
      'Use case EX-LEND-UC01\'s group "Fees" has only one uc requirement, EX-LEND-UC01-R04; merge it into a neighboring group, or give it more.',
    ]);
  });

  it('LA-CHK-UC06-R07-T01 a group with one member is a warning on its parent, standard rules included', async () => {
    let data = changing(complete(), 'standard_rule', () => true, { group_name: 'Imports' });
    data = changing(data, 'api_requirement', () => true, { group_name: 'Errors' });
    data = adding(data, { api_requirement: [{ id: 'EX-LEND-EP01-R02', title: 'Bad body', endpoint_id: 'EX-LEND-EP01', statement: 'A bad body MUST give 400.', group_name: ' errors' }] });
    const ws = await loadData(data);
    expect(ofCheck(ws, 'lone-child').map((p) => p.message)).toEqual([
      'Standard EX-STD-CODE\'s group "Imports" has only one standard rule, EX-STD-CODE-R01; merge it into a neighboring group, or give it more.',
    ]);
  });

  it("LA-CHK-UC06-R07-T02 a product kind's group with one member is a lone-child warning", async () => {
    expect(ofCheck(await loadData(houseRules(['Noise', 'noise', 'Yard'])), 'lone-child').map((p) => p.message)).toEqual([
      'Domain EX-LEND\'s group "Yard" has only one house rule, EX-LEND-HR03; merge it into a neighboring group, or give it more.',
    ]);
  });
});
