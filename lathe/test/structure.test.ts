// Structural warnings, a product's own relations beside Lathe's, and refusals that are not repeated as cascades.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../src/index.ts';
import { everyKind, load, refusals, removeData, withTable } from './helpers.ts';

const recordsOf = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check).map((p) => p.record).sort();
const errors = (ws: Workspace) => ws.problems.filter((p) => p.severity === 'error');

const STRUCTURAL = ['rule-not-applied', 'use-case-without-flow', 'interaction-requirement-fulfills-nothing', 'test-type-mismatch'];

let warnings: Workspace;
let relations: Workspace;
let plain: Workspace;
beforeAll(async () => {
  warnings = await load('structure-warnings');
  relations = await load('structure-relations');
  plain = await load('good');
});
afterAll(removeData);

describe('structural warnings', () => {
  it('LA-CHK-T13 A domain rule that no use case applies is a warning', () => {
    expect(recordsOf(warnings, 'rule-not-applied')).toEqual(['SW-D-DR02']);
    const [problem] = warnings.problems.filter((p) => p.check === 'rule-not-applied');
    expect(problem.message).toContain('SW-D-DR02 is not applied by any use case');
  });

  it('LA-CHK-T14 A use case that no flow carries out is a warning, once its domain has flows', () => {
    // SW-D-F02 fulfills SW-D-UC02's requirement but does not carry out the use case; SW-E has no flows yet.
    expect(recordsOf(warnings, 'use-case-without-flow')).toEqual(['SW-D-UC02']);
    const [problem] = warnings.problems.filter((p) => p.check === 'use-case-without-flow');
    expect(problem.message).toContain('domain SW-D has flows');
    expect(problem.message).toContain('"carries_out"');
  });

  it('LA-CHK-T15 An interaction requirement that fulfills nothing is a warning', () => {
    expect(recordsOf(warnings, 'interaction-requirement-fulfills-nothing')).toEqual(['SW-D-V01-R02']);
  });

  it('LA-CHK-T16 A domain_rule test proving only requirements, or an acceptance test proving only domain rules, is a warning', () => {
    expect(recordsOf(warnings, 'test-type-mismatch')).toEqual(['SW-D-T01', 'SW-D-T02', 'SW-D-T03']);
    const message = (id: string) => warnings.problems.find((p) => p.check === 'test-type-mismatch' && p.record === id)?.message;
    expect(message('SW-D-T01')).toContain('has test_type domain_rule but proves only use case requirements (SW-D-UC01-R01)');
    expect(message('SW-D-T02')).toContain('has test_type acceptance but proves only domain rules (SW-D-DR01)');
  });

  it('LA-CHK-T17 A unit test, another test type, or a test proving both kinds is not compared', () => {
    for (const id of ['SW-D-T04', 'SW-D-T05', 'SW-D-T06', 'SW-D-T07', 'SW-D-T08']) {
      expect(recordsOf(warnings, 'test-type-mismatch')).not.toContain(id);
    }
  });

  it('LA-CHK-T18 Structural gaps are warnings and break nothing', () => {
    const structural = warnings.problems.filter((p) => STRUCTURAL.includes(p.check));
    expect(new Set(structural.map((p) => p.check))).toEqual(new Set(STRUCTURAL));
    for (const p of structural) expect(p.severity).toBe('warning');
    expect(errors(warnings)).toEqual([]);
    // A workspace with none of these gaps gets none of these warnings.
    expect(relations.problems.filter((p) => STRUCTURAL.includes(p.check))).toEqual([]);
  });
});

describe("a product's own relations", () => {
  const rule = (ws: Workspace, relation: string, source: string, target: string) =>
    ws.relations.filter((r) => r.relation === relation && r.source_kind === source && r.target_kind === target);

  it("LA-AUT-T38 A product relation adds a link table of its own, and Lathe's relations keep their roles, labels and descriptions", () => {
    expect(rule(relations, 'owns', 'component', 'aggregate')).toEqual([
      { relation: 'owns', source_kind: 'component', target_kind: 'aggregate', role: '', description: 'The component owns the aggregate.', forward_label: 'Owns', reverse_label: 'Owned by' },
    ]);
    expect(relations.links).toContainEqual({ source: 'SR-D-C01', relation: 'owns', target: 'SR-D-A1' });
    // Lathe's own pairs are the same as in a product with no relations of its own, in the same order.
    expect(rule(relations, 'proves', 'test', 'domain_rule')).toEqual(rule(plain, 'proves', 'test', 'domain_rule'));
    expect(rule(relations, 'fulfills', 'flow', 'requirement')).toEqual(rule(plain, 'fulfills', 'flow', 'requirement'));
    const own = relations.relations.filter((r) => r.relation !== 'owns');
    expect(own).toEqual(plain.relations);
    // A flow's fulfills is not design, so it designs nothing: the requirement it fulfills is still unsatisfied.
    expect(relations.coverage[0].obligations.find((o) => o.kind === 'requirement')).toMatchObject({ total: 1, designed: 0 });
  });

  it('LA-CHK-T19 A relation pair declared twice is refused, naming the file and line', async () => {
    const data = everyKind();
    const problems = await refusals(withTable(data, 'product_relation', [...data.product_relation, data.product_relation[0]]));
    expect(problems).toEqual([expect.objectContaining({ rule: 'primary-key', file: 'data/product_relation.jsonl', line: 3 })]);
  });
});

describe('one mistake, one refusal', () => {
  it("LA-CHK-T20 A test given its rule's ID is one unique-id refusal, and no link to the rule is refused with it", async () => {
    const data = everyKind();
    const problems = await refusals(withTable(data, 'test', [...data.test, { id: 'TL-LEND-DR01', title: 'Keyed by the rule', domain_id: 'TL-LEND', test_type: 'unit', state: 'manual' }]));
    expect(problems).toEqual([expect.objectContaining({ rule: 'unique-id', table: 'test', key: 'TL-LEND-DR01', file: 'data/test.jsonl', line: 2 })]);
    expect(problems[0].message).toContain('already a domain_rule (data/domain_rule.jsonl:1)');
  });

  it('LA-CHK-T21 A link or parent that the schema does not allow is refused once, naming what it may be', async () => {
    const data = everyKind();
    const link = await refusals(withTable(data, 'implements', [...data.implements, { source_id: 'TL-LEND-C01', target_id: 'TL-LEND-DR01' }]));
    expect(link).toEqual([expect.objectContaining({ rule: 'foreign-key', table: 'implements', line: 2 })]);
    expect(link[0].message).toContain('names no implements_target (endpoint, view)');
    // A question cannot sit under a domain rule: it has no column for one.
    const parent = await refusals(withTable(data, 'question', [...data.question, { id: 'TL-LEND-Q09', title: 'Why?', product_id: 'TL', domain_id: 'TL-LEND', domain_rule_id: 'TL-LEND-DR01', owner: 'Owner' }]));
    expect(parent).toEqual([expect.objectContaining({ rule: 'column', table: 'question', line: 2 })]);
  });

  it('LA-CHK-T22 An unknown parent is refused once, as a foreign key naming the missing record', async () => {
    const data = everyKind();
    const problems = await refusals(withTable(data, 'use_case', [...data.use_case, { id: 'TL-LEND-UC09', title: 'Lost', domain_id: 'TL-LEND', capability_id: 'TL-LEND-CAP09' }]));
    expect(problems).toEqual([
      expect.objectContaining({ rule: 'foreign-key', table: 'use_case', key: 'TL-LEND-UC09', message: 'use_case TL-LEND-UC09: capability_id "TL-LEND-CAP09" names no capability' }),
    ]);
  });
});
