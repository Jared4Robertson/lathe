// Structural warnings, relation rules restated by an extension, and errors that are not repeated as cascades.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const recordsOf = (ws: Workspace, check: string) =>
  ws.problems.filter((p) => p.check === check).map((p) => p.record).sort();
const errors = (ws: Workspace) => ws.problems.filter((p) => p.severity === 'error');

const STRUCTURAL = ['rule-not-applied', 'use-case-without-flow', 'interaction-requirement-fulfills-nothing', 'test-type-mismatch'];

let warnings: Workspace;
let cascade: Workspace;
let relations: Workspace;
let plain: Workspace;
beforeAll(async () => {
  warnings = await loadWorkspace(fixture('structure-warnings'));
  cascade = await loadWorkspace(fixture('structure-cascade'));
  relations = await loadWorkspace(fixture('structure-relations'));
  plain = await loadWorkspace(fixture('good'));
});

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

describe('extensions restate default relation rules', () => {
  const rule = (ws: Workspace, relation: string, source: string, target: string) =>
    ws.relations.filter((r) => r.relation === relation && r.source_kind === source && r.target_kind === target);

  it("LA-AUT-T38 An extension row for an existing relation rule is the same rule, and its non-empty role, description or label replaces the default's", () => {
    // Reworded: the description is replaced and the empty role keeps the default's.
    expect(rule(relations, 'proves', 'test', 'domain_rule')).toEqual([
      {
        relation: 'proves',
        source_kind: 'test',
        target_kind: 'domain_rule',
        role: 'proof',
        description: 'The test checks the domain rule in code.',
        forward_label: 'Proves',
        reverse_label: 'Proved by',
      },
    ]);
    // Re-roled and relabeled: the role and the reverse label are replaced, and the empty description and
    // forward label keep the default's.
    const [defaultFulfills] = rule(plain, 'fulfills', 'flow', 'requirement');
    expect(rule(relations, 'fulfills', 'flow', 'requirement')).toEqual([{ ...defaultFulfills, role: 'design', reverse_label: 'Built by flow' }]);
    // So the flow now designs the requirement it fulfills.
    const requirement = relations.coverage[0].obligations.find((o) => o.kind === 'requirement');
    expect(requirement).toMatchObject({ total: 1, designed: 1 });
    // One new rule; no default rule is listed twice, and the defaults keep their order.
    expect(relations.relations).toHaveLength(plain.relations.length + 1);
    expect(relations.relations.slice(0, plain.relations.length).map((r) => [r.relation, r.source_kind, r.target_kind])).toEqual(
      plain.relations.map((r) => [r.relation, r.source_kind, r.target_kind]),
    );
    expect(recordsOf(relations, 'relation-not-allowed')).toEqual([]);
  });

  it('LA-CHK-T19 A relation rule listed twice in one folder is an error naming that folder', () => {
    expect(relations.problems.filter((p) => p.check === 'meta-duplicate-relation')).toEqual([
      {
        severity: 'error',
        check: 'meta-duplicate-relation',
        record: null,
        message: expect.stringContaining('lathe-meta/relations.csv lists relation rule "owns" from component to aggregate 2 times'),
      },
    ]);
    // Only the restatements across folders are allowed: the default rules restated above are not reported.
    expect(errors(relations).map((p) => p.check)).toEqual(['meta-duplicate-relation']);
    // The later row's description wins, as for a restatement.
    expect(rule(relations, 'owns', 'component', 'aggregate')[0].description).toBe('The component stores the aggregate.');
    // An empty label in the later row keeps the earlier row's.
    expect(rule(relations, 'owns', 'component', 'aggregate')[0]).toMatchObject({ forward_label: 'Owns', reverse_label: 'Owned by' });
  });
});

describe('one mistake, one error', () => {
  it("LA-CHK-T20 A rule test keyed by its rule's ID gives one duplicate-id error and no cascaded errors", () => {
    expect(recordsOf(cascade, 'duplicate-id')).toEqual(['SC-D-DR01']);
    // The use case applies, the component satisfies and the tests prove SC-D-DR01: each link fits one of
    // the records with that ID, so none is reported.
    for (const id of ['SC-D-UC01', 'SC-D-C01', 'SC-D-T02']) {
      expect(errors(cascade).filter((p) => p.record === id)).toEqual([]);
    }
    expect(recordsOf(cascade, 'dangling-link')).toEqual([]);
    expect(recordsOf(cascade, 'unsatisfied')).not.toContain('SC-D-DR01');
  });

  it('LA-CHK-T21 A link or parent that no record with a duplicated ID allows is still reported, once', () => {
    const one = (check: string) => cascade.problems.filter((p) => p.check === check);
    expect(one('relation-not-allowed')).toEqual([
      expect.objectContaining({
        record: 'SC-D-C02',
        message: 'SC-D-C02 (component) implements SC-D-DR01 (domain_rule or test), but "implements" is not allowed from component to domain_rule or test.',
      }),
    ]);
    expect(one('parent-kind-not-allowed')).toEqual([
      expect.objectContaining({ record: 'SC-D-Q01', message: expect.stringContaining('sits under SC-D-DR01 (domain_rule or test)') }),
    ]);
  });

  it('LA-CHK-T22 An unknown parent is reported once, as unknown-parent only', () => {
    expect(errors(cascade).filter((p) => p.record === 'SC-D-UC02')).toEqual([
      expect.objectContaining({ check: 'unknown-parent', message: 'SC-D-UC02 names parent SC-D-CAP09, which does not exist.' }),
    ]);
    // Altogether: the duplicate, the unknown parent, and the two links no record allows.
    expect(errors(cascade).map((p) => p.check).sort()).toEqual(['duplicate-id', 'parent-kind-not-allowed', 'relation-not-allowed', 'unknown-parent']);
  });
});
