// Test states and proof by named ID, and meta-model extensions that widen default kinds.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const recordsOf = (ws: Workspace, check: string) =>
  ws.problems.filter((p) => p.check === check).map((p) => p.record).sort();
const errorsAbout = (ws: Workspace, id: string) => ws.problems.filter((p) => p.severity === 'error' && p.record === id);

const TEST_CHECKS = ['test-file-missing', 'test-file-missing-id', 'proof-not-in-file', 'bad-test-state', 'test-run-by-missing'];

let proof: Workspace;
let widened: Workspace;
let duplicate: Workspace;
let plain: Workspace;
beforeAll(async () => {
  proof = await loadWorkspace(fixture('proof-states'));
  widened = await loadWorkspace(fixture('widen-extension'));
  duplicate = await loadWorkspace(fixture('widen-duplicate'));
  plain = await loadWorkspace(fixture('good'));
});

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
  it('LA-TRC-T12 A test state other than automated, manual or planned is an error', () => {
    const found = proof.problems.filter((p) => p.check === 'bad-test-state');
    expect(found).toEqual([
      { severity: 'error', check: 'bad-test-state', record: 'PX-D-T08', message: expect.stringContaining('"someday"') },
    ]);
    // Its file names it, so a bad state is its only problem.
    expect(errorsAbout(proof, 'PX-D-T08')).toHaveLength(1);
  });

  it('LA-TRC-T13 An automated test needs a run_by; a manual or planned test does not', () => {
    // PX-D-T07 is automated by its state, PX-D-T10 by default.
    expect(recordsOf(proof, 'test-run-by-missing')).toEqual(['PX-D-T07', 'PX-D-T10']);
    expect(errorsAbout(proof, 'PX-D-T03')).toEqual([]); // planned
    expect(errorsAbout(proof, 'PX-D-T04')).toEqual([]); // manual
  });

  it("LA-TRC-T14 A manual or planned test's run_by is checked only for existing", () => {
    // PX-D-T05 (manual) names a file that does not exist.
    expect(recordsOf(proof, 'test-file-missing')).toEqual(['PX-D-T05']);
    // PX-D-T06 (planned) names a file that exists but does not mention it, which is fine.
    expect(errorsAbout(proof, 'PX-D-T06')).toEqual([]);
    // Every error in the fixture comes from a test check.
    const other = proof.problems.filter((p) => p.severity === 'error' && !TEST_CHECKS.includes(p.check));
    expect(other).toEqual([]);
  });
});

describe('extensions widen default kinds', () => {
  const kind = (ws: Workspace, name: string) => ws.kinds.find((k) => k.kind === name);

  it('LA-AUT-T23 An extension lets a domain rule sit under a domain', () => {
    expect(kind(widened, 'domain_rule')).toMatchObject({
      parent_kinds: ['aggregate', 'domain', 'entity'],
      required_fields: ['source'],
    });
    expect(errorsAbout(widened, 'WX-D-DR01')).toEqual([]);
    // The widened kind keeps the default's parent, and gains the extension's required field.
    expect(errorsAbout(widened, 'WX-D-DR02').map((p) => p.check)).toEqual(['missing-required-field']);
    expect(widened.kinds.filter((k) => k.kind === 'domain_rule')).toHaveLength(1);
    expect(recordsOf(widened, 'meta-duplicate-kind')).toEqual([]);
    // Without the extension the same kind has only its default parents (a domain is one of them since pass 5),
    // and no required field: the extension's widening is what adds 'source'.
    expect(kind(plain, 'domain_rule')?.parent_kinds).toEqual(['aggregate', 'domain', 'entity']);
    expect(kind(plain, 'domain_rule')?.required_fields).toEqual([]);
  });

  it("LA-AUT-T24 An extension's non-empty values replace the default's and empty ones keep it", () => {
    const widenedRule = kind(widened, 'domain_rule')!;
    const defaultRule = kind(plain, 'domain_rule')!;
    expect(widenedRule.label).toBe('Business rule');
    expect(widenedRule.stage).toBe(defaultRule.stage);
    expect(widenedRule.obligation).toBe(true);
    expect(widenedRule.description).toBe(defaultRule.description);
    // A new kind is added as it is, after the defaults.
    expect(kind(widened, 'policy')).toMatchObject({ label: 'Policy', stage: 'define', parent_kinds: ['domain'], obligation: true });
    expect(widened.kinds.map((k) => k.kind).slice(0, plain.kinds.length)).toEqual(plain.kinds.map((k) => k.kind));
    expect(widened.kinds.at(-1)?.kind).toBe('policy');
  });

  it('LA-AUT-T25 A relation row identical to a default one changes nothing', () => {
    const proves = (ws: Workspace) => ws.relations.filter((r) => r.relation === 'proves' && r.target_kind === 'domain_rule');
    expect(proves(widened)).toEqual(proves(plain));
    expect(widened.relations).toHaveLength(plain.relations.length + 1);
    expect(recordsOf(widened, 'meta-duplicate-relation')).toEqual([]);
  });

  it('LA-AUT-T26 A kind defined twice in one folder is an error naming that folder', () => {
    const found = duplicate.problems.filter((p) => p.check === 'meta-duplicate-kind');
    expect(found).toEqual([
      {
        severity: 'error',
        check: 'meta-duplicate-kind',
        record: null,
        message: expect.stringContaining('lathe-meta/kinds.csv defines kind "domain_rule" 2 times'),
      },
    ]);
    // Both rows still widen the kind.
    expect(kind(duplicate, 'domain_rule')?.parent_kinds).toEqual(['aggregate', 'domain', 'entity', 'product']);
  });
});

describe('test state edges found by the Client re-trial', () => {
  let edges: Workspace;
  beforeAll(async () => {
    edges = await loadWorkspace(fixture('proof-edges'));
  });

  it('LA-TRC-T15 A test state is read in any letter case, the same way by the checks and by coverage', () => {
    expect(recordsOf(edges, 'bad-test-state')).toEqual([]);
    const rules = edges.coverage[0].obligations.find((o) => o.kind === 'domain_rule')!;
    expect(rules.proved).toBe(1);
  });

  it('LA-TRC-T16 A planned test that names a file not written yet is a warning, not an error', () => {
    const found = edges.problems.filter((p) => p.check === 'test-file-missing');
    expect(found).toEqual([
      { severity: 'warning', check: 'test-file-missing', record: 'QX-D-T02', message: expect.stringContaining('does not exist yet') },
    ]);
    expect(edges.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });
});
