import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../src/index.ts';
import { everyKind, fixture, load, refusals, removeData, withTable } from './helpers.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const domainOf = (ws: Workspace, domain: string) => ws.coverage.find((c) => c.domain === domain)!;
const kindOf = (ws: Workspace, domain: string, kind: string) => domainOf(ws, domain).obligations.find((o) => o.kind === kind)!;

let owed: Workspace;
beforeAll(async () => {
  owed = await load('owed-proof');
});
afterAll(removeData);

describe('proof still owed by planned tests', () => {
  it('LA-TRC-T46 planned_any counts every obligation a planned test is meant to prove, proved or not', () => {
    expect(owed.problems.filter((p) => p.severity === 'error')).toEqual([]);
    // OW-A-UC01-R01 is proved by an automated test and R02 by a manual one, each with a planned test as well;
    // R03 has only planned tests; R04 has automated tests only.
    expect(kindOf(owed, 'OW-A', 'requirement')).toEqual({
      kind: 'requirement', label: 'UC requirement', total: 4, designed: 4, built: 4, proved: 3, planned: 1, planned_any: 3,
    });
    // Two planned tests for one obligation count it once.
    expect(kindOf(owed, 'OW-A', 'requirement').planned_any).toBe(3);
  });

  it('LA-TRC-T47 A pattern rule has proof owed only in a domain whose own planned test is meant to prove it', () => {
    // OW-A-T04 (planned) and OW-A-T01 (automated) prove the rule in A; in B only OW-B-T01 (automated) proves it.
    expect(kindOf(owed, 'OW-A', 'pattern_rule')).toMatchObject({ total: 1, proved: 1, planned: 0, planned_any: 1 });
    expect(kindOf(owed, 'OW-B', 'pattern_rule')).toMatchObject({ total: 1, proved: 1, planned: 0, planned_any: 0 });
  });

  it('LA-TRC-T48 Each domain counts its own tests by state, which every test gives', async () => {
    // OW-A: T01 and T02 are automated, T03 is manual, T04 and T05 are planned.
    expect(domainOf(owed, 'OW-A').tests).toEqual({ automated: 2, manual: 1, planned: 2 });
    expect(domainOf(owed, 'OW-B').tests).toEqual({ automated: 1, manual: 0, planned: 0 });
    // A domain with no tests counts zero of each.
    expect(domainOf(owed, 'OW-E').tests).toEqual({ automated: 0, manual: 0, planned: 0 });
    const tests = owed.records.filter((r) => r.kind === 'test');
    const counted = owed.coverage.reduce((n, c) => n + c.tests.automated + c.tests.manual + c.tests.planned, 0);
    expect(counted).toBe(tests.length);
    // A test with no state, or a state in another letter case, is refused: the state is one of three values.
    const data = everyKind();
    const { state: _state, ...stateless } = data.test[0];
    expect(await refusals(withTable(data, 'test', [stateless]))).toEqual([expect.objectContaining({ rule: 'required', file: 'data/test.jsonl' })]);
    expect(await refusals(withTable(data, 'test', [{ ...data.test[0], state: 'Planned' }]))).toEqual([expect.objectContaining({ rule: 'column', file: 'data/test.jsonl' })]);
  });

  it('LA-TRC-T49 planned_any is never less than planned nor more than the total, in every fixture', async () => {
    const names = ['owed-proof', 'coverage-states', 'coverage-extension', 'pattern-good', 'good', 'unfinished'];
    const workspaces = await Promise.all(names.map(load));
    for (const ws of workspaces) {
      for (const c of ws.coverage) {
        expect(Object.keys(c.tests).sort()).toEqual(['automated', 'manual', 'planned']);
        for (const o of c.obligations) {
          expect(o.planned_any).toBeGreaterThanOrEqual(o.planned);
          expect(o.planned_any).toBeLessThanOrEqual(o.total);
        }
      }
    }
  });

  it('LA-TRC-T50 lathe check shows proof owed where it differs from planned, and each domain\'s tests by state', () => {
    const run = spawnSync(process.execPath, [path.join(here, '..', 'bin', 'lathe.ts'), 'check', '--root', fixture('owed-proof')], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    const coverage = run.stdout.slice(run.stdout.indexOf('\nCoverage:'));
    expect(coverage).toContain('  OW-A UC requirement: 4/4 designed, 4/4 built, 3/4 proved, 1/4 planned; 1 gap; 3/4 with a planned test\n');
    expect(coverage).toContain('  OW-A pattern rule: proof only, 1/1 proved, 0/1 planned; 0 gaps; 1/1 with a planned test\n');
    // Where planned_any equals planned, nothing is added.
    expect(coverage).toContain('  OW-B pattern rule: proof only, 1/1 proved, 0/1 planned; 0 gaps\n');
    expect(coverage).toContain('  OW-A tests: 2 automated, 1 manual, 2 planned\n');
    expect(coverage).toContain('  OW-B tests: 1 automated, 0 manual, 0 planned\n');
    expect(coverage).toContain('  OW-E: no obligations\n  OW-E tests: 0 automated, 0 manual, 0 planned\n');
  });
});
