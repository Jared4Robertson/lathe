// Authoring use cases and flows (LA-AUT-UC05, LA-AUT-UC06, LA-AUT-UC13): capabilities, patterns and their rules,
// flows and their steps, groups and tests, proved through the store and the engine's load.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALLOWED_LEVELS, loadWorkspace, openStore, type SchemaDescription, type Workspace } from '../../src/index.ts';
import { everyKind } from '../store/fixture.ts';
import { adding, build, changing, complete, gaps, loadData, obligation, ofCheck, records, refusals, removeData, withTable, without } from '../helpers.ts';
import { described, latheReference, latheSchema, pairsOf, parentsOf, requiredOf } from './shared.ts';

let schema: SchemaDescription;
let good: Workspace;
beforeAll(async () => {
  [schema, good] = await Promise.all([latheSchema(), loadData(complete())]);
});
afterAll(removeData);

const record = (ws: Workspace, id: string) => ws.records.find((r) => r.id === id)!;
const shop = { id: 'EX-SHOP', title: 'Shop', product_id: 'EX', subdomain_type: 'supporting' };

describe('capabilities', () => {
  it("LA-AUT-UC05-R01-T01 A capability sits under a domain with a required whole-number position, and every use case sits under one of its domain's capabilities", async () => {
    expect(parentsOf(schema, 'capability')).toEqual(['domain.domain_id']);
    expect(requiredOf(schema, 'capability')).toEqual(['domain_id', 'position']);
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
    const elsewhere = adding(data, { domain: [{ id: 'TL-SHOP', title: 'Shop', product_id: 'TL', subdomain_type: 'supporting' }], use_case: [{ id: 'TL-SHOP-UC01', title: 'Sell a tool', capability_id: 'TL-LEND-CAP01' }] });
    expect(await refusals(elsewhere)).toEqual([expect.objectContaining({ rule: 'id-prefix', key: 'TL-SHOP-UC01', message: expect.stringContaining('in domain TL-LEND, so its ID starts with TL-LEND-') })]);
  });

  it("LA-AUT-UC05-R02-T01 A use case under a capability, and everything under it, belongs to the capability's domain and counts in its coverage", async () => {
    for (const id of ['EX-LEND-CAP01', 'EX-LEND-UC01', 'EX-LEND-UC01-R01', 'EX-LEND-UC01-FL', 'EX-LEND-UC01-FL-S01', 'EX-LEND-UC01-R01-T01']) {
      expect(record(good, id).domain, id).toBe('EX-LEND');
    }
    expect(record(good, 'EX-PAT-ACT').domain).toBeNull();
    expect(obligation(good, 'EX-LEND', 'uc_requirement')).toMatchObject({ total: 2, designed: 2, built: 2, proved: 2 });
    expect(obligation(good, null, 'uc_requirement')).toMatchObject({ total: 0 });
    // Moved under another capability of the domain, the use case keeps its domain and its coverage.
    const root = await build(adding(complete(), { capability: [{ id: 'EX-LEND-CAP02', title: 'Stock', domain_id: 'EX-LEND', position: 2 }] }));
    const store = await openStore(root, { latheDataDir: null });
    await store.apply([{ op: 'move', id: 'EX-LEND-UC02', parent: 'EX-LEND-CAP02' }]);
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
    expect(await refusals(withTable(everyKind(), 'pattern_rule_test', [everyKind().pattern_rule_test[0], { ...everyKind().pattern_rule_test[0], id: 'TL-PAT-ACT-R01-T02' }]))).toEqual([
      expect.objectContaining({ rule: 'unique', file: 'data/pattern_rule_test.jsonl', line: 2 }),
    ]);
    // A test naming a domain that does not follow the pattern is an error.
    const stray = await loadData(adding(complete(), { domain: [shop], pattern_rule_test: [{ ...test, id: 'EX-PAT-ACT-R01-T02', domain_id: 'EX-SHOP' }] }));
    expect(ofCheck(stray, 'pattern-rule-test-outside-followers')).toEqual([expect.objectContaining({ severity: 'error', record: 'EX-PAT-ACT-R01-T02' })]);
  });
});

describe('flows', () => {
  it('LA-AUT-UC06-R01-T01 A use case has one flow, whose steps need a path and a position, fulfill its requirements, invoke a command or query, happen in a view and exchange with integrations', () => {
    expect(parentsOf(schema, 'flow')).toEqual(['use_case.use_case_id']);
    expect(schema.tables.flow.unique).toContainEqual(['use_case_id']);
    expect(parentsOf(schema, 'flow_step')).toEqual(['flow.flow_id']);
    expect(requiredOf(schema, 'flow_step')).toEqual(['flow_id', 'path', 'position']);
    expect(schema.tables.flow_step.unique).toContainEqual(['flow_id', 'path', 'position']);
    expect(pairsOf(schema, 'fulfills')).toEqual(['flow_step>uc_requirement']);
    expect(pairsOf(schema, 'invokes')).toEqual(['flow_step>command', 'flow_step>query']);
    expect(pairsOf(schema, 'happens_in')).toEqual(['flow_step>view']);
    expect(pairsOf(schema, 'exchanges_with')).toEqual(['flow_step>integration']);
    expect(record(good, 'EX-LEND-UC01-FL-S02')).toMatchObject({ parent: 'EX-LEND-UC01-FL', fields: { path: 'main', position: 2 } });
    const from = (id: string) => good.links.filter((l) => l.source === id).map((l) => `${l.relation} ${l.target}`).sort();
    expect(from('EX-LEND-UC01-FL-S01')).toEqual(['fulfills EX-LEND-UC01-R01', 'happens_in EX-V01', 'invokes EX-LEND-CMD01']);
    expect(from('EX-LEND-UC01-FL-S02')).toEqual(['exchanges_with EX-INT01', 'invokes EX-LEND-QRY01']);
  });

  it('LA-AUT-UC06-R01-T02 A well-formed flow raises no step problem; a second flow, a repeated position, a step fulfilling another use case and a second invoke are refused', async () => {
    expect(ofCheck(good, 'step-order')).toEqual([]);
    const data = adding(everyKind(), { use_case: [{ id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01' }], uc_requirement: [{ id: 'TL-LEND-UC02-R01', title: 'Tool is lent', use_case_id: 'TL-LEND-UC02', statement: 'The library MUST refuse a tool not on loan.' }] });
    expect(await refusals(data)).toEqual([]);
    const flow = data.flow[0];
    const step = data.flow_step[0];
    expect((await refusals(adding(data, { flow: [{ ...flow, id: 'TL-LEND-UC01-FL2' }] }))).map((p) => p.rule)).toEqual(['unique']);
    expect((await refusals(adding(data, { flow_step: [{ ...step, id: 'TL-LEND-UC01-FL-S02' }] }))).map((p) => p.rule)).toEqual(['unique']);
    expect(await refusals(adding(data, { fulfills: [{ source_id: step.id, target_id: 'TL-LEND-UC02-R01' }] }))).toEqual([
      expect.objectContaining({ rule: 'step-fulfills-own-use-case' }),
    ]);
    expect((await refusals(adding(data, { invokes: [{ source_id: step.id, target_id: 'TL-LEND-QRY01' }] }))).map((p) => p.rule)).toEqual(['unique']);
  });

  it('LA-AUT-UC06-R07-T01 A UC requirement no step of its flow fulfills is reported as not designed', async () => {
    const ws = await loadData(without(complete(), 'fulfills', (l) => l.target_id === 'EX-LEND-UC02-R01'));
    expect(obligation(ws, 'EX-LEND', 'uc_requirement')).toMatchObject({ total: 2, designed: 1 });
    expect(ws.coverage.flatMap((c) => c.gaps).filter((g) => g.missing === 'designed')).toEqual([
      { id: 'EX-LEND-UC02-R01', kind: 'uc_requirement', missing: 'designed', message: 'UC requirement EX-LEND-UC02-R01 is not designed yet.' },
    ]);
    expect(ofCheck(ws, 'not-designed')).toEqual([expect.objectContaining({ severity: 'warning', record: 'EX-LEND-UC02-R01', message: 'UC requirement EX-LEND-UC02-R01 is not designed yet.' })]);
  });
});

describe('requirements and tests', () => {
  it('LA-AUT-UC13-R06-T01 Requirements and rules may name a group, a column whose renaming changes no ID', async () => {
    const grouped = ['uc_requirement', 'view_requirement', 'api_requirement', 'pattern_rule', 'standard_rule'];
    for (const kind of grouped) expect(schema.tables[kind].columns.find((c) => c.name === 'group_name'), kind).toMatchObject({ kind: 'text', required: false });
    expect(good.records.filter((r) => grouped.includes(r.kind)).every((r) => r.fields.group_name === undefined)).toBe(true);
    const root = await build(complete());
    const store = await openStore(root, { latheDataDir: null });
    const ids = () => store.query<{ id: string }>('SELECT id FROM record_id ORDER BY id');
    const before = await ids();
    await store.apply(grouped.map((table) => ({ op: 'set' as const, table, key: complete()[table][0].id as string, changes: { group_name: 'Validation' } })));
    await store.apply(grouped.map((table) => ({ op: 'set' as const, table, key: complete()[table][0].id as string, changes: { group_name: 'Checks' } })));
    expect(await ids()).toEqual(before);
    expect(store.rows('uc_requirement').find((r) => r.id === 'EX-LEND-UC01-R01')).toMatchObject({ id: 'EX-LEND-UC01-R01', group_name: 'Checks' });
    await store.close();
    const ws = await loadWorkspace(root);
    for (const table of grouped) expect(record(ws, complete()[table][0].id as string).fields.group_name, table).toBe('Checks');
  });

  it('LA-AUT-UC13-R07-T01 Each test is of the test kind named after what it tests, and sits under that one record, which it proves', async () => {
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
