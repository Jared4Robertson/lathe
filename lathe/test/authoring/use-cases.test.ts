// Authoring use cases and flows (LA-AUT-UC05, LA-AUT-UC06, LA-AUT-UC13): capabilities, patterns and their rules,
// flows and their steps, groups and tests, proved through the store and the engine's load.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALLOWED_LEVELS, loadWorkspace, openStore, type SchemaDescription, type Workspace } from '../../src/index.ts';
import { everyKind } from '../store/fixture.ts';
import { ADD_FLOW } from '../../src/authoring/use-case/commands/add-flow.ts';
import { ADD_FLOW_TEST } from '../../src/authoring/use-case/commands/add-flow-test.ts';
import { runCommand } from '../../src/platform/commands/run.ts';
import { StoreError } from '../../src/platform/data/problems.ts';
import { writeData } from '../helpers.ts';
import { adding, build, changing, complete, gaps, loadData, obligation, ofCheck, records, refusals, removeData, run, withTable, without } from '../helpers.ts';
import { described, latheReference, latheSchema, pairsOf, parentsOf, requiredOf } from './shared.ts';

let schema: SchemaDescription;
let good: Workspace;
beforeAll(async () => {
  [schema, good] = await Promise.all([latheSchema(), loadData(complete())]);
});
afterAll(removeData);

const record = (ws: Workspace, id: string) => ws.records.find((r) => r.id === id)!;
const shop = { id: 'EX-SHOP', title: 'Shop', product_id: 'EX', subdomain_type: 'supporting', description: 'Selling spare parts.' };

describe('capabilities', () => {
  it("LA-AUT-UC02-R04-T01 A capability sits under a domain with a required whole-number position, and every use case sits under one of its domain's capabilities", async () => {
    expect(parentsOf(schema, 'capability')).toEqual(['domain.domain_id']);
    expect(requiredOf(schema, 'capability')).toEqual(['domain_id', 'position', 'description']);
    expect(schema.tables.capability.columns.find((c) => c.name === 'position')!.kind).toBe('integer');
    expect(schema.tables.capability.checks).toContainEqual('("position" >= 1)');
    expect(schema.tables.capability.unique).toContainEqual(['domain_id', 'position']);
    expect(parentsOf(schema, 'use_case')).toEqual(['capability.capability_id']);
    const data = everyKind();
    const capability = data.capability[0];
    const { position: _position, ...unplaced } = capability;
    expect((await refusals(withTable(data, 'capability', [unplaced]))).map((p) => p.message)).toEqual(['capability.position is required']);
    expect((await refusals(withTable(data, 'capability', [{ ...capability, position: 0 }]))).map((p) => p.rule)).toEqual(['check']);
    expect((await refusals(withTable(data, 'capability', [capability, { ...capability, id: 'TL-LEND-CAP02' }]))).map((p) => p.line)).toEqual([2]);
    // A use case with no capability is refused, and so is one whose ID names another domain than its capability's.
    const { capability_id: _, ...loose } = data.use_case[0];
    expect((await refusals(withTable(data, 'use_case', [loose]))).map((p) => p.message)).toEqual(['use_case.capability_id is required']);
    const elsewhere = adding(data, { domain: [{ id: 'TL-SHOP', title: 'Shop', product_id: 'TL', subdomain_type: 'supporting', description: 'Selling spare parts.' }], use_case: [{ id: 'TL-SHOP-UC01', title: 'Sell a tool', capability_id: 'TL-LEND-CAP01', goal: 'A customer buys a used tool.' }] });
    expect(await refusals(elsewhere)).toEqual([expect.objectContaining({ rule: 'id-prefix', key: 'TL-SHOP-UC01', message: expect.stringContaining('in domain TL-LEND, so its ID starts with TL-LEND-') })]);
  });

  it("LA-AUT-UC02-R05-T01 A use case under a capability, and everything under it, belongs to the capability's domain and counts in its coverage", async () => {
    for (const id of ['EX-LEND-CAP01', 'EX-LEND-UC01', 'EX-LEND-UC01-R01', 'EX-LEND-UC01-FL01', 'EX-LEND-UC01-FL01-S01', 'EX-LEND-UC01-R01-T01']) {
      expect(record(good, id).domain, id).toBe('EX-LEND');
    }
    expect(record(good, 'EX-PAT-ACT').domain).toBeNull();
    expect(obligation(good, 'EX-LEND', 'uc_requirement')).toMatchObject({ total: 2, designed: 2, built: 2, proved: 2 });
    expect(obligation(good, null, 'uc_requirement')).toMatchObject({ total: 0 });
    // Moved under another capability of the domain, the use case keeps its domain and its coverage.
    const root = await build(adding(complete(), { capability: [{ id: 'EX-LEND-CAP02', title: 'Stock', domain_id: 'EX-LEND', position: 2, description: 'Keeping the tools in stock.' }] }));
    const store = await openStore(root, { latheDataDir: null });
    await run(store, 'use-case move-use-case', { id: 'EX-LEND-UC02', capability_id: 'EX-LEND-CAP02' });
    await store.close();
    const moved = await loadWorkspace(root);
    expect(record(moved, 'EX-LEND-UC02')).toMatchObject({ parent: 'EX-LEND-CAP02', domain: 'EX-LEND' });
    expect(record(moved, 'EX-LEND-UC02-R01').domain).toBe('EX-LEND');
    expect(obligation(moved, 'EX-LEND', 'uc_requirement')).toEqual(obligation(good, 'EX-LEND', 'uc_requirement'));
  });
});

describe('patterns', () => {
  it('LA-AUT-UC05-R05-T01 A pattern sits under the product with its settings, and use cases or domains follow it', async () => {
    expect(parentsOf(schema, 'pattern')).toEqual(['product.product_id']);
    expect(schema.tables.pattern_setting).toMatchObject({ role: 'part', ownerColumn: 'pattern_id' });
    expect(parentsOf(schema, 'pattern_rule')).toEqual(['pattern.pattern_id']);
    expect(pairsOf(schema, 'follows')).toEqual(['domain>pattern', 'use_case>pattern']);
    expect(schema.relations.follows.role).toBeNull();
    described(await latheReference(), ['pattern', 'pattern_rule'], ['pattern_setting', 'follows', 'setting_value']);
    expect(record(good, 'EX-PAT-ACT')).toMatchObject({ parent: 'EX', domain: null, parts: { pattern_setting: [expect.objectContaining({ name: 'record', position: 1 })] } });
    expect(good.links).toContainEqual({ source: 'EX-LEND-UC02', relation: 'follows', target: 'EX-PAT-ACT' });
    // A domain may follow it too; a requirement, say, may not.
    const ws = await loadData(adding(complete(), { domain: [shop], follows: [{ source_id: 'EX-SHOP', target_id: 'EX-PAT-ACT' }] }));
    expect(ws.links).toContainEqual({ source: 'EX-SHOP', relation: 'follows', target: 'EX-PAT-ACT' });
    for (const check of ['pattern-not-followed', 'pattern-setting-missing', 'pattern-rule-test-outside-followers']) expect(ofCheck(ws, check), check).toEqual([]);
    expect((await refusals(withTable(everyKind(), 'follows', [{ source_id: 'TL-LEND-UC01-R01', target_id: 'TL-PAT-ACT' }]))).length).toBeGreaterThan(0);
  });

  it('LA-AUT-UC05-R10-T01 A pattern rule is owed by each domain that follows its pattern, itself or through a use case, and proved there by one pattern rule test', async () => {
    // EX-LEND follows through its use case and proves the rule; EX-SHOP follows itself and has no test of it yet.
    const ws = await loadData(adding(complete(), { domain: [shop], follows: [{ source_id: 'EX-SHOP', target_id: 'EX-PAT-ACT' }] }));
    expect(obligation(ws, 'EX-LEND', 'pattern_rule')).toMatchObject({ total: 1, proved: 1, proof_only: true });
    expect(obligation(ws, 'EX-SHOP', 'pattern_rule')).toMatchObject({ total: 1, proved: 0 });
    expect(obligation(ws, null, 'pattern_rule')).toMatchObject({ total: 0 });
    expect(gaps(ws).filter((g) => g.includes('EX-PAT'))).toEqual(['proved EX-PAT-ACT-R01']);
    expect(ws.coverage.find((c) => c.domain === 'EX-SHOP')!.gaps.find((g) => g.id === 'EX-PAT-ACT-R01')!.message).toBe('Pattern rule EX-PAT-ACT-R01 is not proved yet in EX-SHOP.');
    // The EX-LEND test does not prove the rule in EX-SHOP; a second test for the same rule and domain is refused.
    const test = complete().pattern_rule_test[0];
    expect(await refusals(withTable(everyKind(), 'pattern_rule_test', [everyKind().pattern_rule_test[0], { ...everyKind().pattern_rule_test[0], id: 'TL-PAT-ACT-R01-T02', title: 'A saved tool reads the same twice' }]))).toEqual([
      expect.objectContaining({ rule: 'unique', file: 'data/pattern_rule_test.jsonl', line: 2 }),
    ]);
    // A test naming a domain that does not follow the pattern is an error.
    const stray = await loadData(adding(complete(), { domain: [shop], pattern_rule_test: [{ ...test, id: 'EX-PAT-ACT-R01-T02', title: 'A saved record reads the same in the shop', domain_id: 'EX-SHOP' }] }));
    expect(ofCheck(stray, 'pattern-rule-test-outside-followers')).toEqual([expect.objectContaining({ severity: 'error', record: 'EX-PAT-ACT-R01-T02' })]);
  });
});

describe('flows', () => {
  it('LA-AUT-UC06-R01-T01 A use case has one flow per interface, whose steps need a path and a position, fulfill its requirements, invoke a command or query, happen in a view and exchange with integrations', () => {
    expect(parentsOf(schema, 'interface')).toEqual(['product.product_id']);
    expect(requiredOf(schema, 'interface')).toEqual(['product_id', 'kind', 'description', 'public']);
    expect(schema.tables.interface.columns.find((c) => c.name === 'kind')?.values).toEqual(['web app', 'API', 'CLI', 'agent tools', 'desktop', 'other']);
    expect(parentsOf(schema, 'flow')).toEqual(['use_case.use_case_id']);
    expect(requiredOf(schema, 'flow')).toEqual(['use_case_id', 'interface_id']);
    expect(schema.tables.flow.unique).toContainEqual(['use_case_id', 'interface_id']);
    expect(record(good, 'EX-LEND-UC01-FL01')).toMatchObject({ parent: 'EX-LEND-UC01', fields: { interface_id: 'EX-IF01' } });
    expect(parentsOf(schema, 'flow_step')).toEqual(['flow.flow_id']);
    expect(requiredOf(schema, 'flow_step')).toEqual(['flow_id', 'path', 'position']);
    expect(schema.tables.flow_step.unique).toContainEqual(['flow_id', 'path', 'position']);
    expect(pairsOf(schema, 'fulfills')).toEqual(['flow_step>uc_requirement']);
    expect(pairsOf(schema, 'invokes')).toEqual(['flow_step>command', 'flow_step>query']);
    expect(pairsOf(schema, 'happens_in')).toEqual(['flow_step>view']);
    expect(pairsOf(schema, 'exchanges_with')).toEqual(['flow_step>integration']);
    expect(record(good, 'EX-LEND-UC01-FL01-S02')).toMatchObject({ parent: 'EX-LEND-UC01-FL01', fields: { path: 'main', position: 2 } });
    const from = (id: string) => good.links.filter((l) => l.source === id).map((l) => `${l.relation} ${l.target}`).sort();
    expect(from('EX-LEND-UC01-FL01-S01')).toEqual(['fulfills EX-LEND-UC01-R01', 'happens_in EX-V01', 'invokes EX-LEND-CMD01']);
    expect(from('EX-LEND-UC01-FL01-S02')).toEqual(['exchanges_with EX-INT01', 'fulfills EX-LEND-UC01-R01', 'invokes EX-LEND-QRY01']);
  });

  it('LA-AUT-UC06-R01-T02 A well-formed flow raises no step problem; a second flow through one interface, a repeated position, a step fulfilling another use case and a second invoke are refused', async () => {
    expect(ofCheck(good, 'step-order')).toEqual([]);
    const data = adding(everyKind(), { use_case: [{ id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'A member brings a borrowed tool back.' }], uc_requirement: [{ id: 'TL-LEND-UC02-R01', title: 'Tool is lent', use_case_id: 'TL-LEND-UC02', statement: 'The library MUST refuse a tool not on loan.' }] });
    expect(await refusals(data)).toEqual([]);
    const flow = data.flow[0];
    const step = data.flow_step[0];
    expect((await refusals(adding(data, { flow: [{ ...flow, title: 'Borrow again' }] }))).map((p) => p.rule)).toEqual(['primary-key']);
    expect((await refusals(adding(data, { flow: [{ ...flow, id: 'TL-LEND-UC01-FL02' }] }))).map((p) => p.rule)).toContain('unique');
    expect((await refusals(adding(data, { flow_step: [{ ...step, id: 'TL-LEND-UC01-FL-S03' }] }))).map((p) => p.rule)).toEqual(['unique']);
    expect(await refusals(adding(data, { fulfills: [{ source_id: step.id, target_id: 'TL-LEND-UC02-R01' }] }))).toEqual([
      expect.objectContaining({ rule: 'step-fulfills-own-use-case' }),
    ]);
    expect((await refusals(adding(data, { invokes: [{ source_id: step.id, target_id: 'TL-LEND-QRY01' }] }))).map((p) => p.rule)).toEqual(['unique']);
  });

  it('LA-AUT-UC06-R07-T01 A UC requirement no step of its flow fulfills is reported as not designed', async () => {
    const ws = await loadData(without(complete(), 'fulfills', (l) => l.target_id === 'EX-LEND-UC02-R01'));
    expect(obligation(ws, 'EX-LEND', 'uc_requirement')).toMatchObject({ total: 2, designed: 1 });
    expect(ws.coverage.flatMap((c) => c.gaps).filter((g) => g.missing === 'designed')).toEqual([
      { id: 'EX-LEND-UC02-R01', kind: 'uc_requirement', missing: 'designed', message: 'UC requirement EX-LEND-UC02-R01 is not designed yet: no step of EX-LEND-UC02-FL01 fulfills it.' },
    ]);
    expect(ofCheck(ws, 'not-designed')).toEqual([expect.objectContaining({ severity: 'warning', record: 'EX-LEND-UC02-R01', message: 'UC requirement EX-LEND-UC02-R01 is not designed yet: no step of EX-LEND-UC02-FL01 fulfills it.' })]);
  });

  it('LA-AUT-UC06-R07-T02 A UC requirement is designed only once a step of every flow of its use case fulfills it', async () => {
    // A second flow of UC01, through a CLI, whose one step fulfills nothing: UC01's requirement is no longer designed.
    const data = adding(complete(), {
      interface: [{ id: 'EX-IF02', title: 'CLI', product_id: 'EX', kind: 'CLI', description: 'The command line the librarian runs.', public: false }],
      flow: [{ id: 'EX-LEND-UC01-FL02', title: 'Borrow from the terminal', use_case_id: 'EX-LEND-UC01', interface_id: 'EX-IF02' }],
      flow_step: [{ id: 'EX-LEND-UC01-FL02-S01', title: 'Run borrow', flow_id: 'EX-LEND-UC01-FL02', path: 'main', position: 1 }],
      flow_test: [{ id: 'EX-LEND-UC01-FL02-T', title: 'Borrow from the terminal', flow_id: 'EX-LEND-UC01-FL02', level: 'system', state: 'manual', manual_reason: 'Done at the desk.', steps: ['Run borrow with a free tool.'], expected_result: 'The loan is opened.' }],
    });
    const short = await loadData(data);
    expect(obligation(short, 'EX-LEND', 'uc_requirement')).toMatchObject({ total: 2, designed: 1 });
    expect(ofCheck(short, 'not-designed').map((p) => p.message)).toEqual(['UC requirement EX-LEND-UC01-R01 is not designed yet: no step of EX-LEND-UC01-FL02 fulfills it.']);
    const met = await loadData(adding(data, { fulfills: [{ source_id: 'EX-LEND-UC01-FL02-S01', target_id: 'EX-LEND-UC01-R01' }] }));
    expect(obligation(met, 'EX-LEND', 'uc_requirement')).toMatchObject({ total: 2, designed: 2 });
  });

  it('LA-AUT-UC06-R08-T01 A flow\'s ID is its use case\'s ID, FL and its interface\'s number, and its interface is of its own product', async () => {
    const data = everyKind();
    const flow = data.flow[0];
    expect(await refusals(data)).toEqual([]);
    // TL-IF02 is a second interface of TL; a flow through it ends in FL02, not FL03.
    const second = adding(data, { interface: [{ id: 'TL-IF02', title: 'CLI', product_id: 'TL', kind: 'CLI', description: 'The command line the librarian runs.', public: false }] });
    expect(await refusals(adding(second, { flow: [{ ...flow, id: 'TL-LEND-UC01-FL02', title: 'Borrow a tool through the CLI', interface_id: 'TL-IF02' }] }))).toEqual([]);
    expect(await refusals(adding(second, { flow: [{ ...flow, id: 'TL-LEND-UC01-FL03', title: 'Borrow a tool through the CLI', interface_id: 'TL-IF02' }] }))).toEqual([
      expect.objectContaining({ rule: 'flow-id-interface', message: 'TL-LEND-UC01-FL03 goes through TL-IF02, so its ID is TL-LEND-UC01-FL02' }),
    ]);
    // An interface of another product is refused.
    const other = adding(second, { product: [{ id: 'XX', title: 'Other', description: 'Another product beside the library.' }], interface: [{ id: 'XX-IF02', title: 'CLI', product_id: 'XX', kind: 'CLI', description: 'The other product\'s command line.', public: false }] });
    expect((await refusals(adding(other, { flow: [{ ...flow, id: 'TL-LEND-UC01-FL02', title: 'Borrow a tool through the CLI', interface_id: 'XX-IF02' }] }))).map((p) => p.rule)).toEqual(['reference-crosses-product']);
  });

  it('LA-AUT-UC06-R09-T01 A step of a flow through an API, a CLI or agent tools happens in no view', async () => {
    const viewed = everyKind();
    const step = viewed.flow_step[0];
    expect(viewed.happens_in).toContainEqual({ source_id: step.id, target_id: 'TL-V01' });
    expect(await refusals(viewed)).toEqual([]);
    for (const kind of ['API', 'CLI', 'agent tools']) {
      const through = changing(viewed, 'interface', () => true, { kind });
      expect(await refusals(through), kind).toEqual([
        expect.objectContaining({ rule: 'step-fits-interface', message: `${step.id} is a step of TL-LEND-UC01-FL, which goes through TL-IF01, an interface of kind ${kind}, so it cannot happen in view TL-V01` }),
      ]);
    }
    for (const kind of ['web app', 'desktop', 'other']) expect(await refusals(changing(viewed, 'interface', () => true, { kind })), kind).toEqual([]);
  });

  it('LA-AUT-UC06-R11-T01 An interface no flow goes through is a gap', async () => {
    const ws = await loadData(adding(complete(), { interface: [{ id: 'EX-IF02', title: 'CLI', product_id: 'EX', kind: 'CLI', description: 'The command line the librarian runs.', public: false }] }));
    expect(ws.coverage.flatMap((c) => c.gaps).filter((g) => g.missing === 'interface-without-flow')).toEqual([
      { id: 'EX-IF02', kind: 'interface', missing: 'interface-without-flow', message: 'Interface EX-IF02 has no flow: no use case happens through it yet.' },
    ]);
  });
});

describe('requirements and tests', () => {
  it('LA-AUT-UC06-R16-T01 Requirements and rules may name a group, a column whose renaming changes no ID', async () => {
    const grouped = ['uc_requirement', 'view_requirement', 'api_requirement', 'pattern_rule', 'standard_rule'];
    for (const kind of grouped) expect(schema.tables[kind].columns.find((c) => c.name === 'group_name'), kind).toMatchObject({ kind: 'text', required: false });
    expect(good.records.filter((r) => grouped.includes(r.kind)).every((r) => r.fields.group_name === undefined)).toBe(true);
    const root = await build(complete());
    const store = await openStore(root, { latheDataDir: null });
    // The data built whole: a write holds its state without building it.
    const ids = async () => (await store.whole((data) => data.query<{ id: string }>('SELECT id FROM record_id ORDER BY id')))?.value;
    const before = await ids();
    const changeOf: Record<string, string> = {
      uc_requirement: 'use-case change-uc-requirement',
      view_requirement: 'view change-view-requirement',
      api_requirement: 'endpoint change-api-requirement',
      pattern_rule: 'pattern change-pattern-rule',
      standard_rule: 'standard change-standard-rule',
    };
    for (const group_name of ['Validation', 'Checks']) {
      for (const table of grouped) await run(store, changeOf[table], { id: complete()[table][0].id, group_name });
    }
    expect(await ids()).toEqual(before);
    expect(store.rows('uc_requirement').find((r) => r.id === 'EX-LEND-UC01-R01')).toMatchObject({ id: 'EX-LEND-UC01-R01', group_name: 'Checks' });
    await store.close();
    const ws = await loadWorkspace(root);
    for (const table of grouped) expect(record(ws, complete()[table][0].id as string).fields.group_name, table).toBe('Checks');
  });

  it('LA-AUT-UC03-R09-T01 Each test is of the test kind named after what it tests, and sits under that one record, which it proves', async () => {
    // What each test kind's name says it tests: its parent, or the record its parent sits under.
    for (const kind of Object.keys(ALLOWED_LEVELS)) {
      const parents = schema.kinds[kind].parents;
      expect(parents, kind).toHaveLength(1);
      const parent = parents[0].kind;
      const named = kind.replace(/_test$/, '');
      const grand = schema.kinds[parent].parents.map((p) => p.kind);
      expect(named === parent || grand.includes(named), `${kind} under ${parent}`).toBe(true);
      expect(schema.kinds[parent].obligation || ['flow', 'integration'].includes(parent), kind).toBe(true);
      expect(schema.tables[kind].columns.find((c) => c.name === parents[0].column)!.required, kind).toBe(true);
    }
    expect(Object.fromEntries(['use_case_test', 'view_test', 'endpoint_test'].map((k) => [k, schema.kinds[k].parents[0].kind]))).toEqual({ use_case_test: 'uc_requirement', view_test: 'view_requirement', endpoint_test: 'api_requirement' });
    // A use case test proves the one requirement it sits under: removing it leaves that requirement, and only that, not proved.
    expect(record(good, 'EX-LEND-UC02-R01-T01').parent).toBe('EX-LEND-UC02-R01');
    const ws = await loadData(without(complete(), 'use_case_test', (t) => t.id === 'EX-LEND-UC02-R01-T01'));
    expect(gaps(ws)).toEqual(['proved EX-LEND-UC02-R01']);
    // A test written under another requirement proves that one instead.
    const moved = await loadData(changing(complete(), 'use_case_test', (t) => t.id === 'EX-LEND-UC02-R01-T01', { id: 'EX-LEND-UC01-R01-T02', uc_requirement_id: 'EX-LEND-UC01-R01' }));
    expect(records(ofCheck(moved, 'not-proved'))).toEqual(['EX-LEND-UC02-R01']);
  });
});

describe('LA-AUT-INV100-T the Use case aggregate refuses a second flow through one interface and a second test of a flow', () => {
  it('refuses each from its command with use-case-one-each, before the unique key underneath', async () => {
    const store = await openStore(writeData(everyKind()), { latheDataDir: null });
    try {
      const refused = async (run: () => Promise<unknown>) => {
        try {
          await run();
        } catch (error) {
          if (error instanceof StoreError) return error.problems.map((p) => ({ rule: p.rule, message: p.message }));
          throw error;
        }
        throw new Error('not refused');
      };
      expect(await refused(() => runCommand(store, ADD_FLOW, { id: 'TL-LEND-UC01-FL', title: 'Borrow a tool again', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF01' }))).toContainEqual(
        expect.objectContaining({ rule: 'use-case-one-each', message: 'use case TL-LEND-UC01 already has its flow through TL-IF01, so TL-LEND-UC01-FL cannot be a second: a use case has one flow per interface' }),
      );
      expect(await refused(() => runCommand(store, ADD_FLOW_TEST, { id: 'TL-LEND-UC01-FL01-T2', title: 'Again', flow_id: 'TL-LEND-UC01-FL', level: 'browser', state: 'automated', file: 'e2e/again.spec.ts', steps: ['Borrow'], expected_result: 'Listed.' }))).toEqual([
        { rule: 'use-case-one-each', message: 'flow TL-LEND-UC01-FL already has its test, so TL-LEND-UC01-FL01-T2 cannot be a second: a flow has one' },
      ]);
    } finally {
      await store.close();
    }
  });
});
