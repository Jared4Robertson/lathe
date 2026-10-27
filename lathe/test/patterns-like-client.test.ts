// Patterns used as Client uses them: adopted per domain, with or without settings, their rules needing proof
// only, and carried out by interaction requirements and flow steps (brief 32, third Client trial N2-N6).
// Fixtures: s2patterns-adopt (domains SX-A to SX-E), s2patterns-flows (SF-A) and s2patterns-design (a product
// that declares a proof-only kind and a kind that is not an obligation).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';
import { everyKind, load, ofCheck, refusals, removeData } from './helpers.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const coverageOf = (ws: Workspace, domain: string) => ws.coverage.find((c) => c.domain === domain);
const line = (ws: Workspace, domain: string, kind = 'pattern_rule') => coverageOf(ws, domain)?.obligations.find((o) => o.kind === kind);
const gaps = (ws: Workspace, domain: string) => coverageOf(ws, domain)?.gaps.filter((g) => g.kind === 'pattern_rule');
const kindOf = (ws: Workspace, kind: string) => ws.kinds.find((k) => k.kind === kind);

let adopt: Workspace;
let flows: Workspace;
let design: Workspace;
beforeAll(async () => {
  [adopt, flows, design] = await Promise.all(['s2patterns-adopt', 's2patterns-flows', 's2patterns-design'].map(load));
});
afterAll(removeData);

describe('obligation values in the schema', () => {
  it('LA-AUT-T56 A kind\'s obligation is full, proof (proof only) or none (not an obligation)', () => {
    expect(kindOf(adopt, 'pattern_rule')).toMatchObject({ obligation: true, proof_only: true });
    expect(kindOf(adopt, 'requirement')).toMatchObject({ obligation: true, proof_only: false });
    expect(kindOf(adopt, 'pattern')).toMatchObject({ obligation: false, proof_only: false, required_fields: [] });
    // The product declares control with obligation proof and memo with none; Lathe's pattern_rule stays proof only.
    expect(kindOf(design, 'pattern_rule')).toMatchObject({ obligation: true, proof_only: true });
    expect(kindOf(design, 'control')).toMatchObject({ obligation: true, proof_only: true });
    expect(kindOf(design, 'memo')).toMatchObject({ obligation: false, proof_only: false });
    for (const ws of [adopt, flows, design]) expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });
});

describe('a domain that follows a pattern', () => {
  it('LA-TRC-T51 A domain that follows a pattern itself owes every one of its rules, even where its use cases say not applicable', () => {
    // SX-B follows Staff action itself; its one use case marks audit not applicable, yet R02 (setting audit) is owed.
    expect(line(adopt, 'SX-B')).toMatchObject({ total: 2, proved: 1 });
    expect(gaps(adopt, 'SX-B')).toEqual([{ id: 'SX-PAT-ACT-R02', kind: 'pattern_rule', missing: 'proves' }]);
    expect(ofCheck(adopt, 'unproved').map((p) => p.message)).toContain(
      'Pattern rule SX-PAT-ACT-R02 is not proved in SX-B: no test in SX-B proves it, though the domain follows its pattern.',
    );
  });

  it('LA-TRC-T52 A domain follows a pattern when it or any of its use cases follows it, and owes each rule once', () => {
    // SX-A follows API conventions itself and Staff action through its use case: 2 + 2 rules.
    expect(line(adopt, 'SX-A')).toEqual({ kind: 'pattern_rule', label: 'Pattern rule', total: 4, designed: 4, built: 4, proved: 4, planned: 0, planned_any: 0 });
    expect(gaps(adopt, 'SX-A')).toEqual([]);
  });

  it('LA-TRC-T53 Not applicable still works through use-case setting values when the domain follows only through its use cases', () => {
    expect(line(adopt, 'SX-C')).toMatchObject({ total: 1, proved: 1 });
    expect(gaps(adopt, 'SX-C')).toEqual([]);
    expect(adopt.problems.filter((p) => p.message.includes('SX-C') && p.record?.startsWith('SX-PAT'))).toEqual([]);
  });

  it('LA-TRC-T54 A domain that follows no pattern, itself or through a use case, owes no pattern rule', () => {
    expect(line(adopt, 'SX-D')).toMatchObject({ total: 0 });
    expect(gaps(adopt, 'SX-D')).toEqual([]);
  });
});

describe('patterns without settings', () => {
  it('LA-TRC-T55 A pattern may have no settings; its rules apply wherever it is followed and nothing asks for settings', () => {
    expect(adopt.records.find((r) => r.id === 'SX-PAT-API')?.parts.pattern_setting).toBeUndefined();
    expect(ofCheck(adopt, 'pattern-setting-missing')).toEqual([]);
    // SX-E's use case follows API conventions and gives no fields; both rules are owed there.
    expect(line(adopt, 'SX-E')?.total).toBe(2);
  });
});

describe('proof-only obligations', () => {
  it('LA-TRC-T56 A proof-only obligation counts as designed and built, has no satisfies gap and is never unsatisfied', () => {
    for (const domain of ['SX-A', 'SX-B', 'SX-C', 'SX-E']) {
      const l = line(adopt, domain);
      expect(l?.designed, domain).toBe(l?.total);
      expect(l?.built, domain).toBe(l?.total);
    }
    expect(adopt.coverage.flatMap((c) => c.gaps).filter((g) => g.missing === 'satisfies')).toEqual([]);
    expect(ofCheck(adopt, 'unsatisfied')).toEqual([]);
  });

  it('LA-TRC-T57 Proved, planned and proof gaps of a proof-only obligation work as before', () => {
    expect(line(adopt, 'SX-E')).toEqual({ kind: 'pattern_rule', label: 'Pattern rule', total: 2, designed: 2, built: 2, proved: 0, planned: 2, planned_any: 2 });
    expect(gaps(adopt, 'SX-E')).toEqual([
      { id: 'SX-PAT-API-R01', kind: 'pattern_rule', missing: 'proves' },
      { id: 'SX-PAT-API-R02', kind: 'pattern_rule', missing: 'proves' },
    ]);
    expect(ofCheck(adopt, 'unproved').filter((p) => p.message.includes('SX-E')).map((p) => p.message)).toEqual([
      'Pattern rule SX-PAT-API-R01 is not proved in SX-E yet: its test there is only planned.',
      'Pattern rule SX-PAT-API-R02 is not proved in SX-E yet: its test there is only planned.',
    ]);
  });

  it('LA-TRC-T58 A product cannot make pattern rules full obligations again: pattern_rule is Lathe\'s kind, so it is never widened', async () => {
    // Widening a kind of Lathe's is a migration, not a declaration: a product kind may not take a table name Lathe has.
    const data = everyKind();
    const widened = { ...data, product_kind: [{ ...data.product_kind[0], name: 'pattern_rule', parent_kind: 'pattern' }], product_kind_field: [], product_relation: [], invariant: [], enforces: [], proves: data.proves.filter((l) => l.target_id !== 'TL-LEND-INV01') };
    expect(await refusals(widened)).toEqual([expect.objectContaining({ rule: 'product-kind', message: expect.stringContaining('pattern_rule has the name of a table Lathe already has') })]);
    // So a pattern rule asks for proof alone in every domain that owes it, and is never unsatisfied.
    expect(line(design, 'SD-A')).toMatchObject({ total: 2, designed: 2, built: 2, proved: 2 });
    expect(line(design, 'SD-B')).toMatchObject({ total: 2, designed: 2, built: 2, proved: 2 });
    expect(ofCheck(design, 'unsatisfied')).toEqual([]);
    expect(ofCheck(design, 'unproved')).toEqual([]);
  });

  it("LA-TRC-T59 A product's own proof-only kind is counted for proof alone, and a kind that is not an obligation is not counted", () => {
    expect(line(design, 'SD-A', 'control')).toEqual({ kind: 'control', label: 'Control', total: 1, designed: 1, built: 1, proved: 1, planned: 0, planned_any: 0 });
    expect(line(design, 'SD-A', 'memo')).toBeUndefined();
    expect(design.problems.filter((p) => p.record === 'SD-A-CT01' || p.record === 'SD-A-M01')).toEqual([]);
  });
});

describe('use cases that follow a pattern', () => {
  it('LA-TRC-T60 A use case that follows a pattern needs no requirements of its own', () => {
    expect(ofCheck(adopt, 'use-case-without-requirements').map((p) => p.record)).toEqual(['SX-D-UC01']);
  });
});

describe('pattern rules as targets of interaction requirements and flow steps', () => {
  it('LA-TRC-T61 An interaction requirement and a flow step may fulfill a pattern rule', () => {
    const rules = flows.relations.filter((r) => r.relation === 'fulfills' && r.target_kind === 'pattern_rule').map((r) => r.source_kind).sort();
    expect(rules).toEqual(['flow_step', 'interaction_requirement']);
    expect(ofCheck(flows, 'data-refused')).toEqual([]);
    expect(flows.links.filter((l) => l.relation === 'fulfills' && l.target.startsWith('SF-PAT')).length).toBeGreaterThan(0);
    expect(ofCheck(flows, 'interaction-requirement-fulfills-nothing')).toEqual([]);
  });

  it("LA-TRC-T62 A step may fulfill the rules of the patterns its flow's use cases or its domain follow, and interaction requirements that fulfill them", () => {
    const reported = ofCheck(flows, 'flow-step-fulfills-outside-flow').map((p) => p.record);
    for (const step of ['SF-A-F01-S01', 'SF-A-F01-S02', 'SF-A-F01-S04']) expect(reported, step).not.toContain(step);
  });

  it('LA-TRC-T63 A step that fulfills a rule of a pattern only another use case follows is reported, as is an interaction requirement that fulfills it', () => {
    const found = ofCheck(flows, 'flow-step-fulfills-outside-flow');
    expect(found.map((p) => [p.record, p.message.split(',')[0]])).toEqual([
      ['SF-A-F01-S03', 'Flow step SF-A-F01-S03 fulfills SF-PAT-OTHER-R01'],
      ['SF-A-F01-S05', 'Flow step SF-A-F01-S05 fulfills SF-A-V01-R02'],
    ]);
    expect(found[0].message).toContain('a use case the flow carries out (SF-A-UC01)');
    expect(found[0].message).toContain('nor a rule of a pattern one of them or the domain follows');
    expect(found.every((p) => p.severity === 'warning')).toBe(true);
  });
});

describe("the Tool Library's pattern", () => {
  it('LA-TRC-T64 The Tool Library still reads sensibly: its proof-only pattern rules are proved, with nothing asked for design', async () => {
    const repo = await loadWorkspace(path.resolve(HERE, '..', '..', 'examples', 'tool-library'));
    expect(line(repo, 'TL-LEND')).toMatchObject({ total: 3, designed: 3, built: 3, proved: 3, planned: 0 });
    expect(repo.problems.filter((p) => p.record?.startsWith('TL-PAT'))).toEqual([]);
  });
});
