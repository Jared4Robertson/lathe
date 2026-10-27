// Test states and proof by named ID, and a product's own kinds and relations beside Lathe's.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Row, Workspace } from '../src/index.ts';
import { everyKind, load, refusals, removeData, withTable } from './helpers.ts';

const recordsOf = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check).map((p) => p.record).sort();
const errorsAbout = (ws: Workspace, id: string) => ws.problems.filter((p) => p.severity === 'error' && p.record === id);

const TEST_CHECKS = ['test-file-missing', 'test-file-missing-id', 'proof-not-in-file'];

let proof: Workspace;
let widened: Workspace;
let plain: Workspace;
beforeAll(async () => {
  proof = await load('proof-states');
  widened = await load('widen-extension');
  plain = await load('good');
});
afterAll(removeData);

/** The everyKind product with its one test changed. */
const withTest = (changes: Record<string, string | undefined>) => {
  const data = everyKind();
  const test: Row = { ...data.test[0] };
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined) delete test[k];
    else test[k] = v;
  }
  return withTable(data, 'test', [test]);
};

describe('tests prove what their files name', () => {
  it("LA-TRC-T09 A rule test keyed by the rule's ID needs no test ID in code", () => {
    // PX-D-T01's file names PX-D-DR01, the rule it proves, and never PX-D-T01.
    expect(errorsAbout(proof, 'PX-D-T01')).toEqual([]);
  });

  it('LA-TRC-T10 A test file that names neither the test nor a record it proves is an error', () => {
    expect(recordsOf(proof, 'proof-not-in-file')).toEqual(['PX-D-T02', 'PX-D-T09']);
    const [problem] = proof.problems.filter((p) => p.record === 'PX-D-T02');
    expect(problem).toMatchObject({ severity: 'error', check: 'proof-not-in-file' });
    expect(problem.message).toContain('code/rules.test.txt');
    expect(problem.message).toContain('names neither PX-D-T02 nor PX-D-DR02');
  });

  it('LA-TRC-T11 A test file names an ID only as a whole ID', () => {
    // PX-D-T09 proves PX-D-DR03; its file names PX-D-DR030 and PX-D-DR03-R01, which are other IDs.
    expect(errorsAbout(proof, 'PX-D-T09').map((p) => p.check)).toEqual(['proof-not-in-file']);
  });
});

describe('test states', () => {
  it('LA-TRC-T12 A test state other than automated, manual or planned is refused', async () => {
    const problems = await refusals(withTest({ state: 'someday' }));
    expect(problems).toEqual([expect.objectContaining({ rule: 'column', table: 'test' })]);
    expect(problems[0].message).toContain('automated, manual, planned');
    // A test always has a state.
    expect(await refusals(withTest({ state: undefined }))).toEqual([expect.objectContaining({ rule: 'required', table: 'test' })]);
  });

  it('LA-TRC-T13 An automated test needs a file; a manual or planned test does not', async () => {
    expect(await refusals(withTest({ file: undefined }))).toEqual([expect.objectContaining({ rule: 'check', table: 'test', key: 'TL-LEND-T01' })]);
    expect(await refusals(withTest({ file: undefined, state: 'manual' }))).toEqual([]);
    expect(await refusals(withTest({ file: undefined, state: 'planned' }))).toEqual([]);
    expect(errorsAbout(proof, 'PX-D-T03')).toEqual([]); // planned, no file
    expect(errorsAbout(proof, 'PX-D-T04')).toEqual([]); // manual, no file
  });

  it("LA-TRC-T14 A manual or planned test's file is checked only for existing", () => {
    // PX-D-T05 (manual) names a file that does not exist.
    expect(recordsOf(proof, 'test-file-missing')).toEqual(['PX-D-T05']);
    // PX-D-T06 (planned) names a file that exists but does not mention it, which is fine.
    expect(errorsAbout(proof, 'PX-D-T06')).toEqual([]);
    // Every error in the fixture comes from a test check.
    expect(proof.problems.filter((p) => p.severity === 'error' && !TEST_CHECKS.includes(p.check))).toEqual([]);
  });
});

describe("a product's own kinds and relations", () => {
  const kind = (ws: Workspace, name: string) => ws.kinds.find((k) => k.kind === name);

  it("LA-AUT-T21 A domain rule may sit under its domain alone, and a product cannot widen Lathe's own kinds", async () => {
    expect(widened.records.find((r) => r.id === 'WX-D-DR01')).toMatchObject({ parent: 'WX-D', domain: 'WX-D' });
    expect(errorsAbout(widened, 'WX-D-DR01')).toEqual([]);
    expect(kind(plain, 'domain_rule')?.parent_kinds).toEqual(['entity', 'aggregate', 'domain']);
    expect(kind(widened, 'domain_rule')).toEqual(kind(plain, 'domain_rule'));
    // A product kind may not take a Lathe kind's name: changing Lathe's kinds is a migration.
    const data = everyKind();
    const widen = await refusals(withTable(data, 'product_kind', [...data.product_kind, { name: 'domain_rule', product_id: 'TL', label: 'Business rule', description: 'A rule.', parent_kind: 'product', obligation: 'full' }]));
    expect(widen).toEqual([expect.objectContaining({ rule: 'product-kind', table: 'product_kind' })]);
    expect(widen[0].message).toContain('domain_rule');
  });

  it("LA-AUT-T22 A product's own kind is added after Lathe's, with its own label, stage and obligation, and Lathe's kinds keep theirs", () => {
    expect(kind(widened, 'policy')).toMatchObject({ label: 'Policy', stage: 'define', parent_kinds: ['domain'], obligation: true, description: 'A policy the business sets.' });
    expect(widened.kinds.map((k) => k.kind).slice(0, plain.kinds.length)).toEqual(plain.kinds.map((k) => k.kind));
    expect(widened.kinds.slice(0, plain.kinds.length)).toEqual(plain.kinds);
    expect(widened.kinds.at(-1)?.kind).toBe('policy');
  });

  it("LA-AUT-T23 A product relation with Lathe's name adds a pair and changes none of Lathe's", () => {
    const proves = (ws: Workspace) => ws.relations.filter((r) => r.relation === 'proves' && r.target_kind === 'domain_rule');
    expect(proves(widened)).toEqual(proves(plain));
    expect(widened.relations).toHaveLength(plain.relations.length + 1);
    expect(widened.relations).toContainEqual(expect.objectContaining({ relation: 'proves', source_kind: 'test', target_kind: 'policy', role: 'proof' }));
  });

  it('LA-AUT-T24 A kind declared twice is refused, naming the file and line', async () => {
    const data = everyKind();
    const problems = await refusals(withTable(data, 'product_kind', [...data.product_kind, ...data.product_kind]));
    expect(problems).toEqual([expect.objectContaining({ rule: 'primary-key', file: 'data/product_kind.jsonl', line: 2, key: 'invariant' })]);
    expect(problems[0].message).toContain('line 1');
  });
});

describe('test state edges found by the Client re-trial', () => {
  let edges: Workspace;
  beforeAll(async () => {
    edges = await load('proof-edges');
  });

  it('LA-TRC-T15 A test state is one lower-case value, read the same way by the checks and by coverage', async () => {
    expect(await refusals(withTest({ state: 'Manual' }))).toEqual([expect.objectContaining({ rule: 'column', table: 'test' })]);
    // QX-D-T01 is manual and proves QX-D-DR01: coverage counts it, and no check reports the test.
    const rules = edges.coverage[0].obligations.find((o) => o.kind === 'domain_rule')!;
    expect(rules.proved).toBe(1);
    expect(edges.problems.filter((p) => p.record === 'QX-D-T01')).toEqual([]);
  });

  it('LA-TRC-T16 A planned test that names a file not written yet is a warning, not an error', () => {
    expect(edges.problems.filter((p) => p.check === 'test-file-missing')).toEqual([
      { severity: 'warning', check: 'test-file-missing', record: 'QX-D-T02', message: expect.stringContaining('does not exist yet') },
    ]);
    expect(edges.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });
});
