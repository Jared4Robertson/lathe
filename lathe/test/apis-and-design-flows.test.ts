// APIs, integrations and technical flows: the kinds, where they sit, the positions of technical steps, coverage
// counting a step's satisfies as design, and the design-flow-deepens-nothing warning.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../src/index.ts';
import { everyKind, load, refusals, removeData, withTable } from './helpers.ts';

const recordsOf = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check).map((p) => p.record).sort();
const messagesOf = (ws: Workspace, check: string, record: string) =>
  ws.problems.filter((p) => p.check === check && p.record === record).map((p) => p.message).sort();
const errorsOf = (ws: Workspace) => ws.problems.filter((p) => p.severity === 'error');

let good: Workspace;
let broken: Workspace;
beforeAll(async () => {
  good = await load('apis-and-design-flows');
  broken = await load('design-steps-broken');
});
afterAll(removeData);
const data = everyKind();
const step = data.design_step[0];

describe('APIs and integrations', () => {
  it('LA-AUT-T130 An API sits in a domain and holds its endpoints and the interaction requirements they share', () => {
    const kind = (name: string) => good.kinds.find((k) => k.kind === name);
    expect(kind('api')).toMatchObject({ label: 'API', stage: 'design', section: 'interaction-design', parent_kinds: ['domain'], obligation: false });
    expect(kind('endpoint')?.parent_kinds).toEqual(['api', 'domain']);
    expect(good.kinds.filter((k) => k.parent_kinds.includes('api')).map((k) => k.kind)).toEqual(['endpoint', 'interaction_requirement']);
    expect(good.records.find((r) => r.id === 'AD-D-E01')).toMatchObject({ parent: 'AD-D-API01', domain: 'AD-D' });
    expect(good.records.find((r) => r.id === 'AD-D-API01-R01')).toMatchObject({ kind: 'interaction_requirement', parent: 'AD-D-API01', domain: 'AD-D' });
    expect(errorsOf(good)).toEqual([]);
  });

  it("LA-AUT-T131 An integration holds one interaction requirement per exchange and may name its system, and an interaction requirement may sit under the domain", () => {
    const kind = (name: string) => good.kinds.find((k) => k.kind === name);
    expect(kind('integration')).toMatchObject({ stage: 'design', section: 'interaction-design', parent_kinds: ['domain'], required_fields: [] });
    expect(kind('interaction_requirement')?.parent_kinds).toEqual(['view', 'endpoint', 'flow', 'api', 'integration', 'domain']);
    expect(good.records.find((r) => r.id === 'AD-D-INT01')).toMatchObject({ kind: 'integration', fields: { system: 'Mail service' } });
    expect(good.records.find((r) => r.id === 'AD-D-INT01-R01')).toMatchObject({ parent: 'AD-D-INT01', domain: 'AD-D' });
    expect(good.records.find((r) => r.id === 'AD-D-IR01')).toMatchObject({ parent: 'AD-D', domain: 'AD-D' });
    // Each counts as an interaction requirement the domain owes.
    const owed = good.coverage.find((c) => c.domain === 'AD-D')?.obligations.find((o) => o.kind === 'interaction_requirement');
    expect(owed?.total).toBe(4);
  });
});

describe('technical flows', () => {
  it('LA-AUT-T132 A technical flow sits in a domain or a layer and deepens a flow, and its steps have a position, use components and satisfy obligations', () => {
    const kind = (name: string) => good.kinds.find((k) => k.kind === name);
    expect(kind('design_flow')).toMatchObject({ label: 'Technical flow', stage: 'design', section: 'technical-specification', parent_kinds: ['layer', 'domain'] });
    expect(kind('design_step')).toMatchObject({ label: 'Technical step', parent_kinds: ['design_flow'], required_fields: ['path', 'position'], obligation: false });
    const rules = good.relations.filter((r) => r.source_kind === 'design_flow' || r.source_kind === 'design_step')
      .map((r) => `${r.source_kind} ${r.relation} ${r.target_kind} ${r.role}`.trim()).sort();
    expect(rules).toEqual([
      'design_flow deepens flow', 'design_step meets standard_rule',
      'design_step satisfies domain_rule design', 'design_step satisfies interaction_requirement design',
      'design_step satisfies pattern_rule design', 'design_step satisfies requirement design',
      'design_step uses component',
    ]);
    expect(good.records.find((r) => r.id === 'AD-D-DF01-S01')).toMatchObject({
      kind: 'design_step', parent: 'AD-D-DF01', domain: 'AD-D',
      fields: { position: 1, path: 'main', transaction_name: 'borrow', locks: "the tool's row", statements: '2' },
    });
    expect(good.links.filter((l) => l.source === 'AD-D-DF01').map((l) => `${l.relation} ${l.target}`)).toEqual(['deepens AD-D-F01']);
    // A step on another path may share a position with one on the main path.
    expect(recordsOf(good, 'step-order')).toEqual([]);
  });

  it("LA-AUT-T133 A technical step's satisfies counts as design, but only a component whose file exists counts as built", () => {
    const coverage = good.coverage.find((c) => c.domain === 'AD-D')!;
    const of = (kind: string) => coverage.obligations.find((o) => o.kind === kind)!;
    // AD-D-DR01 and AD-D-UC01-R01 and R02 are designed only by technical steps.
    expect(of('domain_rule')).toMatchObject({ total: 1, designed: 1, built: 0 });
    expect(of('requirement')).toMatchObject({ total: 2, designed: 2, built: 0 });
    // AD-D-API01-R01 is designed by a step only; the others by components whose files exist.
    expect(of('interaction_requirement')).toMatchObject({ total: 4, designed: 4, built: 3 });
    expect(coverage.gaps.filter((g) => g.missing === 'satisfies')).toEqual([]);
    expect(recordsOf(good, 'unsatisfied')).toEqual([]);
  });

  it("LA-AUT-T134 A technical step's position is checked on its path, as a flow step's is", async () => {
    // A position that is not a whole number, one another step of the path has, or none, is refused.
    expect(await refusals(withTable(data, 'design_step', [{ ...step, position: 'two' }]))).toEqual([expect.objectContaining({ rule: 'column', file: 'data/design_step.jsonl' })]);
    expect(await refusals(withTable(data, 'design_step', [step, { ...step, id: 'TL-LEND-DF01-S02', title: 'Twin' }]))).toEqual([
      expect.objectContaining({ rule: 'unique', table: 'design_step', key: 'TL-LEND-DF01-S02' }),
    ]);
    const { position: _position, ...without } = step;
    expect(await refusals(withTable(data, 'design_step', [without]))).toEqual([expect.objectContaining({ rule: 'required', file: 'data/design_step.jsonl' })]);
    // A path whose positions skip a number, read in any letter case, is reported once.
    expect(recordsOf(broken, 'step-order')).toEqual(['DS-D-DF01-S04']);
    expect(messagesOf(broken, 'step-order', 'DS-D-DF01-S04')).toEqual([
      'Technical step DS-D-DF01-S04 has position 2 on path refused in technical flow DS-D-DF01, but no step of that path has position 1; number the steps of a path 1, 2, 3 and so on, with no gaps.',
    ]);
    for (const p of broken.problems.filter((x) => x.check === 'step-order')) expect(p.severity).toBe('error');
  });

  it('LA-AUT-T135 A technical flow that deepens no flow is a design-flow-deepens-nothing warning', async () => {
    expect(recordsOf(good, 'design-flow-deepens-nothing')).toEqual(['AD-D-DF02']);
    expect(messagesOf(good, 'design-flow-deepens-nothing', 'AD-D-DF02')).toEqual([
      'Technical flow AD-D-DF02 deepens no flow; link the flow it carries out with "deepens".',
    ]);
    expect(good.problems.find((p) => p.check === 'design-flow-deepens-nothing')?.severity).toBe('warning');
    // A technical flow sits in a domain or a layer: it has no column for a flow to hold it.
    const problems = await refusals(withTable(data, 'design_flow', [{ ...data.design_flow[0], flow_id: 'TL-LEND-F01' }]));
    expect(problems).toEqual([expect.objectContaining({ rule: 'column', file: 'data/design_flow.jsonl' })]);
    expect(problems[0].message).toContain('has no column "flow_id"');
  });
});
