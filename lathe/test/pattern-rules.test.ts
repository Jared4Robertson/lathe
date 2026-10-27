// Pattern rules: obligations of every domain that follows the pattern, unless not applicable there.
// Fixtures: pattern-good (PX-PAT-ACT followed by domains A to D, not by E) and pattern-broken.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';
import { everyKind, load, loadData, ofCheck, refusals, removeData, withTable } from './helpers.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const coverageOf = (ws: Workspace, domain: string) => ws.coverage.find((c) => c.domain === domain);
const patternRules = (ws: Workspace, domain: string) => coverageOf(ws, domain)?.obligations.find((o) => o.kind === 'pattern_rule');
const ruleGaps = (ws: Workspace, domain: string) => coverageOf(ws, domain)?.gaps.filter((g) => g.kind === 'pattern_rule');
const R01 = 'PX-PAT-ACT-R01';
const R02 = 'PX-PAT-ACT-R02';

let good: Workspace;
let broken: Workspace;
beforeAll(async () => {
  good = await load('pattern-good');
  broken = await load('pattern-broken');
});
afterAll(removeData);

describe('the pattern rule kind', () => {
  it('LA-TRC-T20 A pattern rule is an obligation under a pattern, designed by components and proved by tests', () => {
    expect(good.kinds.find((k) => k.kind === 'pattern_rule')).toMatchObject({ parent_kinds: ['pattern'], obligation: true });
    const roles = good.relations.filter((r) => r.target_kind === 'pattern_rule').map((r) => [r.relation, r.source_kind, r.role]);
    expect(roles).toEqual(expect.arrayContaining([['satisfies', 'component', 'design'], ['proves', 'test', 'proof']]));
    expect(good.records.find((r) => r.id === R02)).toMatchObject({ domain: null, parent: 'PX-PAT-ACT', fields: { setting: 'audit' } });
    expect(good.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });
});

describe('coverage of pattern rules', () => {
  it('LA-TRC-T21 Each domain that follows a pattern owes its rules, on one pattern rule line', () => {
    const lines = coverageOf(good, 'PX-A')?.obligations.filter((o) => o.kind === 'pattern_rule');
    expect(lines).toEqual([{ kind: 'pattern_rule', label: 'Pattern rule', total: 2, designed: 2, built: 2, proved: 2, planned: 0, planned_any: 0 }]);
    expect(patternRules(good, 'PX-B')?.total).toBe(2);
    expect(patternRules(good, 'PX-D')?.total).toBe(2);
  });

  it('LA-TRC-T22 A domain that does not follow the pattern does not owe its rules', () => {
    expect(patternRules(good, 'PX-E')).toMatchObject({ total: 0, designed: 0, proved: 0 });
    expect(ruleGaps(good, 'PX-E')).toEqual([]);
    expect(good.problems.some((p) => p.message.includes('PX-E') && p.record?.startsWith('PX-PAT'))).toBe(false);
  });

  it("LA-TRC-T23 Only the domain's own components and tests design and prove a pattern rule there", () => {
    // PX-A's test proves both rules, but counts only in PX-A. Pattern rules are proof-only, so designed equals total.
    expect(patternRules(good, 'PX-B')).toMatchObject({ total: 2, designed: 2, proved: 0 });
    expect(patternRules(good, 'PX-D')).toMatchObject({ total: 2, designed: 2, proved: 0 });
  });

  it('LA-TRC-T24 Built and planned are counted per domain too', () => {
    // Proof-only: designed and built equal total, whatever the components.
    expect(patternRules(good, 'PX-B')).toMatchObject({ total: 2, designed: 2, built: 2 });
    // PX-C's only test of R01 is planned.
    expect(patternRules(good, 'PX-C')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 0, planned: 1 });
  });

  it('LA-TRC-T25 A rule whose setting every following use case marks not applicable does not apply in that domain', () => {
    // Both of PX-C's following use cases give the audit setting a not_applicable reason, so R02 is not counted there.
    expect(ruleGaps(good, 'PX-C')?.map((g) => g.id)).toEqual([R01]);
    expect(good.problems.filter((p) => p.record === R02 && p.message.includes('PX-C'))).toEqual([]);
  });

  it('LA-TRC-T26 A rule still applies when only some following use cases mark its setting not applicable', () => {
    expect(ruleGaps(good, 'PX-D')).toEqual([
      { id: R01, kind: 'pattern_rule', missing: 'proves' },
      { id: R02, kind: 'pattern_rule', missing: 'proves' },
    ]);
  });

  it('LA-TRC-T27 A rule that names no setting applies in every following domain', () => {
    for (const domain of ['PX-A', 'PX-B', 'PX-C', 'PX-D']) {
      const owed = (patternRules(good, domain)?.total ?? 0) > 0;
      expect(owed, domain).toBe(true);
    }
    expect(ruleGaps(good, 'PX-C')?.some((g) => g.id === R01)).toBe(true);
  });

  it('LA-TRC-T28 Gaps name the pattern rule in each domain that lacks it', () => {
    expect(ruleGaps(good, 'PX-A')).toEqual([]);
    expect(ruleGaps(good, 'PX-B')).toEqual([
      { id: R01, kind: 'pattern_rule', missing: 'proves' },
      { id: R02, kind: 'pattern_rule', missing: 'proves' },
    ]);
  });
});

describe('unsatisfied and unproved pattern rules', () => {
  it('LA-TRC-T29 An undesigned pattern rule is reported once for each domain that owes it', () => {
    // Pattern rules are proof-only (and a product cannot widen them, patterns-like-client.test.ts), so none is unsatisfied.
    expect(ofCheck(good, 'unsatisfied').filter((p) => p.record?.startsWith('PX-PAT'))).toEqual([]);
  });

  it('LA-TRC-T30 An unproved pattern rule is reported once for each domain that owes it, saying when its test is only planned', () => {
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
  it("LA-AUT-T32 A rule whose setting is not one of its pattern's settings is refused by the store", async () => {
    // pattern_rule (pattern_id, setting) is a foreign key into pattern_setting (pattern_id, name).
    const data = everyKind();
    const changed = withTable(data, 'pattern_rule', data.pattern_rule.map((r) => ({ ...r, setting: 'recrod', applies_when_setting: 'record' })));
    expect(await refusals(changed)).toEqual([
      expect.objectContaining({ rule: 'foreign-key', file: 'data/pattern_rule.jsonl', line: 1, message: expect.stringContaining('setting "recrod"') }),
    ]);
  });

  it('LA-TRC-T31 A rule naming one of its pattern settings, or none, loads and is not reported', async () => {
    const data = everyKind();
    expect(await refusals(data)).toEqual([]);
    const { setting: _setting, applies_when_setting: _s, applies_when_negated: _n, applies_when_value: _v, ...plain } = data.pattern_rule[0];
    expect(await refusals(withTable(data, 'pattern_rule', [plain]))).toEqual([]);
    expect(good.problems.filter((p) => p.record?.startsWith('PX-PAT') && p.severity === 'error')).toEqual([]);
  });

  it('LA-TRC-T32 A pattern that no use case follows is a warning', () => {
    expect(ofCheck(broken, 'pattern-not-followed')).toEqual([
      expect.objectContaining({ severity: 'warning', record: 'QX-PAT-EMPTY', message: expect.stringContaining('not used anywhere') }),
      expect.objectContaining({ severity: 'warning', record: 'QX-PAT-IDLE', message: expect.stringContaining('its 2 rules are not counted') }),
    ]);
    expect(ofCheck(good, 'pattern-not-followed')).toEqual([]);
  });

  it('LA-TRC-T33 The rules of a pattern nobody follows count in no domain and are not reported as outside one', () => {
    expect(coverageOf(broken, 'QX-D')?.gaps.map((g) => g.id)).not.toContain('QX-PAT-IDLE-R01');
    const idle = broken.problems.filter((p) => p.record?.startsWith('QX-PAT-IDLE-'));
    expect(idle).toEqual([]);
    expect(ofCheck(good, 'obligation-outside-domain')).toEqual([]);
  });

  it('LA-TRC-T34 Any other obligation outside every domain is a warning', async () => {
    // Lathe's own obligations always sit in a domain: a domain rule without one is refused.
    const data = everyKind();
    const { domain_id: _domain, ...homeless } = data.domain_rule[1];
    expect(await refusals(withTable(data, 'domain_rule', [data.domain_rule[0], homeless]))).toEqual([
      expect.objectContaining({ rule: 'required', file: 'data/domain_rule.jsonl', line: 2 }),
    ]);
    // A product's own obligation kind declared under the product sits in no domain, and is reported.
    const ws = await loadData({
      product: [{ id: 'QY', title: 'Promises' }],
      product_kind: [{ name: 'promise', product_id: 'QY', label: 'Promise', description: 'A promise the product makes.', parent_kind: 'product', obligation: 'full' }],
      promise: [{ id: 'QY-PR01', title: 'Always answers', product_id: 'QY' }],
    });
    expect(ofCheck(ws, 'obligation-outside-domain')).toEqual([
      {
        severity: 'warning',
        check: 'obligation-outside-domain',
        record: 'QY-PR01',
        message: "Promise QY-PR01 sits in no domain, so no domain's coverage counts it; move it under a domain.",
      },
    ]);
  });
});

describe("the Tool Library's patterns", () => {
  it('LA-TRC-T35 TL-LEND designs and proves every Librarian action rule', async () => {
    const library = await loadWorkspace(path.resolve(HERE, '..', '..', 'examples', 'tool-library'));
    expect(patternRules(library, 'TL-LEND')).toMatchObject({ total: 3, designed: 3, built: 3, proved: 3, planned: 0 });
    expect(ofCheck(library, 'pattern-not-followed')).toEqual([]);
  });
});
