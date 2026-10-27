// APIs, integrations and technical flows (FORMAT.md sections 20 and 21): the kinds, where they sit,
// the order check on technical steps, coverage counting a step's satisfies as design, and the
// design-flow-deepens-nothing warning.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const recordsOf = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check).map((p) => p.record).sort();
const messagesOf = (ws: Workspace, check: string, record: string) =>
  ws.problems.filter((p) => p.check === check && p.record === record).map((p) => p.message).sort();
const errorsOf = (ws: Workspace) => ws.problems.filter((p) => p.severity === 'error');

let good: Workspace;
let broken: Workspace;
beforeAll(async () => {
  good = await loadWorkspace(fixture('apis-and-design-flows'));
  broken = await loadWorkspace(fixture('design-steps-broken'));
});

describe('APIs and integrations', () => {
  it('LA-AUT-T130 An API sits in a domain and holds its endpoints and the interaction requirements they share', () => {
    const kind = (name: string) => good.kinds.find((k) => k.kind === name);
    expect(kind('api')).toMatchObject({ label: 'API', stage: 'design', section: 'interaction-design', parent_kinds: ['domain'], obligation: false });
    expect(kind('endpoint')?.parent_kinds).toEqual(['domain', 'api']);
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
    expect(recordsOf(good, 'parent-kind-not-allowed')).toEqual([]);
  });
});

describe('technical flows', () => {
  it('LA-AUT-T132 A technical flow sits in a domain or a layer and deepens a flow, and its steps have an order, use components and satisfy obligations', () => {
    const kind = (name: string) => good.kinds.find((k) => k.kind === name);
    expect(kind('design_flow')).toMatchObject({ label: 'Technical flow', stage: 'design', section: 'technical-specification', parent_kinds: ['domain', 'layer'] });
    expect(kind('design_step')).toMatchObject({ label: 'Technical step', parent_kinds: ['design_flow'], required_fields: ['order'], obligation: false });
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
      fields: { order: '1', transaction: 'borrow', locks: "the tool's row", statements: '2' },
    });
    expect(good.links.filter((l) => l.source === 'AD-D-DF01').map((l) => `${l.relation} ${l.target}`)).toEqual(['deepens AD-D-F01']);
    // A step on another path may share an order with one on the main path.
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

  it("LA-AUT-T134 A technical step's order is checked on its path, as a flow step's is", () => {
    expect(recordsOf(broken, 'step-order')).toEqual(['DS-D-DF01-S01', 'DS-D-DF01-S02', 'DS-D-DF01-S03', 'DS-D-DF01-S04']);
    expect(messagesOf(broken, 'step-order', 'DS-D-DF01-S01')).toEqual([
      'Technical step DS-D-DF01-S01 has order 1 in technical flow DS-D-DF01, the same as DS-D-DF01-S02; each step of a technical flow needs its own order.',
    ]);
    expect(messagesOf(broken, 'step-order', 'DS-D-DF01-S03')).toEqual([
      'Technical step DS-D-DF01-S03 has order "two", which is not a whole number such as 1 or 2.',
    ]);
    expect(messagesOf(broken, 'step-order', 'DS-D-DF01-S04')).toEqual([
      'Technical step DS-D-DF01-S04 has order 2 on path refused in technical flow DS-D-DF01, but no step of that path has order 1; number the steps of a path 1, 2, 3 and so on, with no gaps.',
    ]);
    expect(recordsOf(broken, 'missing-required-field')).toEqual(['DS-D-DF01-S05']);
    for (const p of broken.problems.filter((x) => x.check === 'step-order')) expect(p.severity).toBe('error');
  });

  it('LA-AUT-T135 A technical flow that deepens no flow is a design-flow-deepens-nothing warning', () => {
    expect(recordsOf(good, 'design-flow-deepens-nothing')).toEqual(['AD-D-DF02']);
    expect(messagesOf(good, 'design-flow-deepens-nothing', 'AD-D-DF02')).toEqual([
      'Technical flow AD-D-DF02 deepens no flow; link the flow it carries out with "deepens".',
    ]);
    expect(good.problems.find((p) => p.check === 'design-flow-deepens-nothing')?.severity).toBe('warning');
    // A technical flow must sit in a domain or a layer.
    expect(recordsOf(broken, 'parent-kind-not-allowed')).toEqual(['DS-D-DF02']);
  });
});
