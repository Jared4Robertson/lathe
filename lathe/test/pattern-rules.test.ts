// Pattern rules: obligations of every domain that follows the pattern, unless Not applicable there.
// Fixtures: pattern-good (PX-PAT-ACT followed by domains A to D, not by E) and pattern-broken.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(HERE, 'fixtures', name);
const ofCheck = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check);
const coverageOf = (ws: Workspace, domain: string) => ws.coverage.find((c) => c.domain === domain);
const patternRules = (ws: Workspace, domain: string) => coverageOf(ws, domain)?.obligations.find((o) => o.kind === 'pattern_rule');
const ruleGaps = (ws: Workspace, domain: string) => coverageOf(ws, domain)?.gaps.filter((g) => g.kind === 'pattern_rule');
const R01 = 'PX-PAT-ACT-R01';
const R02 = 'PX-PAT-ACT-R02';

let good: Workspace;
let broken: Workspace;
beforeAll(async () => {
  good = await loadWorkspace(fixture('pattern-good'));
  broken = await loadWorkspace(fixture('pattern-broken'));
});

describe('the pattern rule kind', () => {
  it('LA-CHK-T90 A pattern rule is an obligation under a pattern, designed by components and proved by tests', () => {
    expect(good.kinds.find((k) => k.kind === 'pattern_rule')).toMatchObject({ parent_kinds: ['pattern'], obligation: true });
    const roles = good.relations.filter((r) => r.target_kind === 'pattern_rule').map((r) => [r.relation, r.source_kind, r.role]);
    expect(roles).toEqual(expect.arrayContaining([['satisfies', 'component', 'design'], ['proves', 'test', 'proof']]));
    expect(good.records.find((r) => r.id === R02)).toMatchObject({ domain: null, fields: { setting: 'audit' } });
    expect(good.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });
});

describe('coverage of pattern rules', () => {
  it('LA-CHK-T91 Each domain that follows a pattern owes its rules, on one pattern rule line', () => {
    const lines = coverageOf(good, 'PX-A')?.obligations.filter((o) => o.kind === 'pattern_rule');
    expect(lines).toEqual([{ kind: 'pattern_rule', label: 'Pattern rule', total: 2, designed: 2, built: 2, proved: 2, planned: 0, planned_any: 0 }]);
    expect(patternRules(good, 'PX-B')?.total).toBe(2);
    expect(patternRules(good, 'PX-D')?.total).toBe(2);
  });

  it('LA-CHK-T92 A domain that does not follow the pattern does not owe its rules', () => {
    expect(patternRules(good, 'PX-E')).toMatchObject({ total: 0, designed: 0, proved: 0 });
    expect(ruleGaps(good, 'PX-E')).toEqual([]);
    expect(good.problems.some((p) => p.message.includes('PX-E') && p.record?.startsWith('PX-PAT'))).toBe(false);
  });

  it("LA-CHK-T93 Only the domain's own components and tests design and prove a pattern rule there", () => {
    // PX-A's test proves both rules, but counts only in PX-A. Pattern rules are proof-only by default, so
    // designed equals total; per-domain design is tested with an extension in patterns-like-client.test.ts.
    expect(patternRules(good, 'PX-B')).toMatchObject({ total: 2, designed: 2, proved: 0 });
    expect(patternRules(good, 'PX-D')).toMatchObject({ total: 2, designed: 2, proved: 0 });
  });

  it('LA-CHK-T94 Built and planned are counted per domain too', () => {
    // Proof-only: designed and built equal total, whatever the components.
    expect(patternRules(good, 'PX-B')).toMatchObject({ total: 2, designed: 2, built: 2 });
    // PX-C's only test of R01 is planned.
    expect(patternRules(good, 'PX-C')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 0, planned: 1 });
  });

  it('LA-CHK-T95 A rule whose setting every following use case marks Not applicable does not apply in that domain', () => {
    // Both of PX-C's following use cases mark audit Not applicable (in any letter case), so R02 is not counted there.
    expect(ruleGaps(good, 'PX-C')?.map((g) => g.id)).toEqual([R01]);
    expect(good.problems.filter((p) => p.record === R02 && p.message.includes('PX-C'))).toEqual([]);
  });

  it('LA-CHK-T96 A rule still applies when only some following use cases mark its setting Not applicable', () => {
    expect(ruleGaps(good, 'PX-D')).toEqual([
      { id: R01, kind: 'pattern_rule', missing: 'proves' },
      { id: R02, kind: 'pattern_rule', missing: 'proves' },
    ]);
  });

  it('LA-CHK-T97 A rule that names no setting applies in every following domain', () => {
    for (const domain of ['PX-A', 'PX-B', 'PX-C', 'PX-D']) {
      const owed = (patternRules(good, domain)?.total ?? 0) > 0;
      expect(owed, domain).toBe(true);
    }
    expect(ruleGaps(good, 'PX-C')?.some((g) => g.id === R01)).toBe(true);
  });

  it('LA-CHK-T98 Gaps name the pattern rule in each domain that lacks it', () => {
    expect(ruleGaps(good, 'PX-A')).toEqual([]);
    expect(ruleGaps(good, 'PX-B')).toEqual([
      { id: R01, kind: 'pattern_rule', missing: 'proves' },
      { id: R02, kind: 'pattern_rule', missing: 'proves' },
    ]);
  });
});

describe('unsatisfied and unproved pattern rules', () => {
  it('LA-CHK-T99 An undesigned pattern rule is reported once for each domain that owes it', () => {
    // Pattern rules are proof-only by default, so none is unsatisfied; the per-domain message is tested
    // with an extension that makes them full obligations, in patterns-like-client.test.ts.
    expect(ofCheck(good, 'unsatisfied').filter((p) => p.record?.startsWith('PX-PAT'))).toEqual([]);
  });

  it('LA-CHK-T100 An unproved pattern rule is reported once for each domain that owes it, saying when its test is only planned', () => {
    const found = ofCheck(good, 'unproved').filter((p) => p.record?.startsWith('PX-PAT'));
    expect(found.map((p) => [p.record, p.message.match(/ in (PX-[A-E])/)?.[1]])).toEqual([
      [R01, 'PX-B'],
      [R01, 'PX-C'],
      [R01, 'PX-D'],
      [R02, 'PX-B'],
      [R02, 'PX-D'],
    ]);
    expect(found.find((p) => p.message.includes('PX-B'))?.message).toBe(
      'Pattern rule PX-PAT-ACT-R01 is not proved in PX-B: no test in PX-B proves it, though the domain follows its pattern.',
    );
    expect(found.find((p) => p.message.includes('PX-C'))?.message).toBe(
      'Pattern rule PX-PAT-ACT-R01 is not proved in PX-C yet: its test there is only planned.',
    );
  });
});

describe('pattern rule checks', () => {
  it("LA-CHK-T101 A rule whose setting is not one of its pattern's settings is an error", () => {
    expect(ofCheck(broken, 'pattern-rule-setting-unknown')).toEqual([
      {
        severity: 'error',
        check: 'pattern-rule-setting-unknown',
        record: 'QX-PAT-USED-R01',
        message: 'Pattern rule QX-PAT-USED-R01 depends on the setting "adit", which pattern QX-PAT-USED does not list; its settings are: audit.',
      },
    ]);
  });

  it('LA-CHK-T102 A rule naming one of its pattern settings, or none, is not reported', () => {
    expect(ofCheck(good, 'pattern-rule-setting-unknown')).toEqual([]);
    expect(ofCheck(broken, 'pattern-rule-setting-unknown').map((p) => p.record)).not.toContain('QX-PAT-USED-R02');
  });

  it('LA-CHK-T103 A pattern that no use case follows is a warning', () => {
    expect(ofCheck(broken, 'pattern-not-followed')).toEqual([
      expect.objectContaining({ severity: 'warning', record: 'QX-PAT-EMPTY', message: expect.stringContaining('not used anywhere') }),
      expect.objectContaining({ severity: 'warning', record: 'QX-PAT-IDLE', message: expect.stringContaining('its 2 rules are not counted') }),
    ]);
    expect(ofCheck(good, 'pattern-not-followed')).toEqual([]);
  });

  it("LA-CHK-T104 The rules of a pattern nobody follows count in no domain and are not reported as outside one", () => {
    expect(coverageOf(broken, 'QX-D')?.gaps.map((g) => g.id)).not.toContain('QX-PAT-IDLE-R01');
    const idle = broken.problems.filter((p) => p.record?.startsWith('QX-PAT-IDLE-'));
    expect(idle).toEqual([]);
    expect(ofCheck(good, 'obligation-outside-domain')).toEqual([]);
  });

  it('LA-CHK-T105 Any other obligation outside every domain is a warning', () => {
    expect(ofCheck(broken, 'obligation-outside-domain')).toEqual([
      {
        severity: 'warning',
        check: 'obligation-outside-domain',
        record: 'QX-DR01',
        message: "Domain rule QX-DR01 sits in no domain, so no domain's coverage counts it; move it under a domain.",
      },
    ]);
  });
});

describe("the Tool Library's patterns", () => {
  it('LA-CHK-T106 TL-LEND designs and proves both Librarian action rules', async () => {
    const repo = await loadWorkspace(path.resolve(HERE, '..', '..'));
    expect(patternRules(repo, 'TL-LEND')).toMatchObject({ total: 2, designed: 2, built: 2, proved: 2, planned: 0 });
    expect(ofCheck(repo, 'pattern-not-followed').filter((p) => p.record?.startsWith('TL-'))).toEqual([]);
  });
});
