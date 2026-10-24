import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(here, 'fixtures', name);
const ofCheck = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check);

let states: Workspace;
let extension: Workspace;
beforeAll(async () => {
  states = await loadWorkspace(fixture('coverage-states'));
  extension = await loadWorkspace(fixture('coverage-extension'));
});

describe('coverage by the meta-model', () => {
  it('LA-CHK-T40 Coverage counts every obligation kind in meta-model order, including interaction requirements', () => {
    expect(states.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(states.coverage).toHaveLength(1);
    expect(states.coverage[0].obligations).toEqual([
      { kind: 'domain_rule', label: 'Domain rule', total: 1, designed: 0, built: 0, proved: 0, planned: 0, planned_any: 0 },
      { kind: 'requirement', label: 'Requirement', total: 2, designed: 2, built: 2, proved: 1, planned: 1, planned_any: 2 },
      { kind: 'pattern_rule', label: 'Pattern rule', total: 0, designed: 0, built: 0, proved: 0, planned: 0, planned_any: 0 },
      { kind: 'interaction_requirement', label: 'Interaction requirement', total: 2, designed: 2, built: 2, proved: 2, planned: 0, planned_any: 0 },
    ]);
    // The order is the meta-model's.
    const order = states.kinds.filter((k) => k.obligation).map((k) => k.kind);
    expect(states.coverage[0].obligations.map((o) => o.kind)).toEqual(order);
  });

  it('LA-CHK-T41 Only automated and manual tests prove; a planned test makes an obligation planned', () => {
    // CS-D-V01-IR01 is proved by a test with no state (automated); CS-D-V01-IR02 by a manual test.
    // CS-D-UC01-R01 has only a planned test; CS-D-UC01-R02 has a planned and an automated one, so it is proved.
    const unproved = ofCheck(states, 'unproved');
    expect(unproved.map((p) => p.record).sort()).toEqual(['CS-D-DR01', 'CS-D-UC01-R01']);
    expect(unproved.every((p) => p.severity === 'warning')).toBe(true);
    expect(unproved.find((p) => p.record === 'CS-D-UC01-R01')?.message).toContain('only planned');
    expect(unproved.find((p) => p.record === 'CS-D-DR01')?.message).not.toContain('planned');
    expect(states.coverage[0].gaps).toEqual([
      { id: 'CS-D-DR01', kind: 'domain_rule', missing: 'satisfies' },
      { id: 'CS-D-DR01', kind: 'domain_rule', missing: 'proves' },
      { id: 'CS-D-UC01-R01', kind: 'requirement', missing: 'proves' },
    ]);
  });

  it("LA-CHK-T42 An extension's obligation kind and design and proof relations are counted like the defaults", () => {
    expect(extension.problems.filter((p) => p.severity === 'error')).toEqual([]);
    const invariant = extension.coverage[0].obligations.find((o) => o.kind === 'invariant');
    // EXT-D-INV01 is enforced by a component whose file exists and checked by a test;
    // EXT-D-INV02 is designed only by a sketch, so it is designed but not built.
    expect(invariant).toEqual({ kind: 'invariant', label: 'Invariant', total: 2, designed: 2, built: 1, proved: 1, planned: 0, planned_any: 0 });
    expect(extension.coverage[0].obligations.map((o) => o.kind)).toEqual(['domain_rule', 'requirement', 'pattern_rule', 'interaction_requirement', 'invariant']);
    // A kind not marked as an obligation is not counted.
    expect(extension.coverage[0].obligations.some((o) => o.kind === 'sketch')).toBe(false);
    expect(ofCheck(extension, 'unsatisfied')).toEqual([]);
    expect(ofCheck(extension, 'unproved').map((p) => p.record)).toEqual(['EXT-D-INV02']);
    expect(extension.coverage[0].gaps).toEqual([{ id: 'EXT-D-INV02', kind: 'invariant', missing: 'proves' }]);
  });

  it('LA-CHK-T43 The requirement and rule counts are kept, filled from the obligation counts', async () => {
    const c = states.coverage[0];
    expect(c).toMatchObject({
      requirements: 2, requirements_satisfied: 2, requirements_built: 2, requirements_proved: 1,
      rules: 1, rules_satisfied: 0, rules_built: 0, rules_proved: 0,
    });
    const workspaces = [states, extension, ...(await Promise.all(['good', 'unfinished', 'broken-links'].map((n) => loadWorkspace(fixture(n)))))];
    for (const ws of workspaces) {
      for (const cov of ws.coverage) {
        const req = cov.obligations.find((o) => o.kind === 'requirement')!;
        const rule = cov.obligations.find((o) => o.kind === 'domain_rule')!;
        expect([cov.requirements, cov.requirements_satisfied, cov.requirements_built, cov.requirements_proved]).toEqual([req.total, req.designed, req.built, req.proved]);
        expect([cov.rules, cov.rules_satisfied, cov.rules_built, cov.rules_proved]).toEqual([rule.total, rule.designed, rule.built, rule.proved]);
        for (const o of cov.obligations) {
          expect(o.built).toBeLessThanOrEqual(o.designed);
          expect(o.proved + o.planned).toBeLessThanOrEqual(o.total);
        }
      }
    }
  });

  it("LA-CHK-T44 The meta-model's obligation and role columns are loaded into the workspace", async () => {
    const obligations = states.kinds.filter((k) => k.obligation).map((k) => k.kind);
    expect(obligations).toEqual(['domain_rule', 'requirement', 'pattern_rule', 'interaction_requirement']);
    expect(states.relations.filter((r) => r.role === 'design').map((r) => `${r.relation} ${r.target_kind}`)).toEqual([
      'satisfies requirement', 'satisfies domain_rule', 'satisfies interaction_requirement', 'satisfies pattern_rule',
    ]);
    expect(states.relations.filter((r) => r.role === 'proof').map((r) => `${r.relation} ${r.target_kind}`)).toEqual([
      'proves requirement', 'proves domain_rule', 'proves interaction_requirement', 'proves pattern_rule',
    ]);
    expect(states.relations.find((r) => r.relation === 'fulfills')?.role).toBe('');
    expect(extension.relations.find((r) => r.relation === 'sketches')?.role).toBe('design');
    expect(extension.kinds.find((k) => k.kind === 'invariant')?.obligation).toBe(true);
    expect(extension.kinds.find((k) => k.kind === 'sketch')?.obligation).toBe(false);
    // An extension folder without the new columns still loads: nothing in it is an obligation or has a role.
    const configured = await loadWorkspace(fixture('configured'));
    expect(configured.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(configured.kinds.find((k) => k.kind === 'report')?.obligation).toBe(false);
    expect(configured.relations.find((r) => r.relation === 'summarises')?.role).toBe('');
  });

  it('LA-CHK-T45 The check prints one coverage line per domain and obligation kind, with planned counts', () => {
    const run = spawnSync(process.execPath, [path.join(here, '..', 'bin', 'lathe.ts'), 'check', '--root', fixture('coverage-states')], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    const coverage = run.stdout.slice(run.stdout.indexOf('\nCoverage:'));
    expect(coverage).toContain('  CS-D domain_rule: 0/1 designed, 0/1 built, 0/1 proved, 0/1 planned; 2 gaps');
    expect(coverage).toContain('  CS-D requirement: 2/2 designed, 2/2 built, 1/2 proved, 1/2 planned; 1 gap');
    expect(coverage).toContain('  CS-D interaction_requirement: 2/2 designed, 2/2 built, 2/2 proved, 0/2 planned; 0 gaps');
  });
});
