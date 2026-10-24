import { describe, expect, it } from 'vitest';
import type { SpecRecord, Workspace } from '../../../lathe/src/types';
import { groupId, HIERARCHY_TIERS, isGrouped, neighbourhood, tierOf, TRACE_TIERS, traceChain } from '../../src/graph/model';
import { layoutNeighbourhood } from '../../src/graph/layout';
import { indexWorkspace } from '../../src/specs/data';
import { testWorkspace } from './workspace';

// Flow steps in the graph: under their flow, through a group like other children, and in traces.

function flowWorkspace(stepCount: number): Workspace {
  const w = testWorkspace();
  if (!w.kinds.some((k) => k.kind === 'flow_step')) {
    w.kinds.push({ kind: 'flow_step', label: 'Flow step', stage: 'design', parent_kinds: ['flow'], required_fields: ['order'], obligation: false, description: 'One step of a flow.' });
  }
  const record = (id: string, kind: string, title: string, parent: string, fields: Record<string, string> = {}): SpecRecord => ({
    id, kind, title, parent, fields, body: '', product: 'P', domain: 'P-D', path: `specs/${id}.md`, mentions: [],
  });
  w.records.push(record('P-D-F01', 'flow', 'Lend a thing', 'P-D'));
  w.links.push({ source: 'P-D-F01', relation: 'carries_out', target: 'P-D-UC01' });
  for (let i = 1; i <= stepCount; i++) {
    const id = `P-D-F01-S0${i}`;
    w.records.push(record(id, 'flow_step', `Step ${i}`, 'P-D-F01', { order: String(i) }));
    w.links.push({ source: id, relation: 'uses', target: 'P-D-V01' });
  }
  // The first step fulfills the requirement and is carried out by the service.
  w.links.push({ source: 'P-D-F01-S01', relation: 'fulfills', target: 'P-D-UC01-R01' });
  w.links.push({ source: 'P-D-F01-S01', relation: 'uses', target: 'P-D-C01' });
  return w;
}

const recordIds = (n: { nodes: { id: string; group?: unknown }[] }) => n.nodes.filter((x) => !x.group).map((x) => x.id).sort();
const spine = (n: { edges: { source: string; target: string; relation: string }[] }) =>
  n.edges.filter((e) => e.relation === 'parent').map((e) => `${e.source} > ${e.target}`).sort();

describe('flow steps in the graph', () => {
  it('LA-BRW-T204 A flow step sits one tier to the right of its flow, joined to it by the parent line', () => {
    const index = indexWorkspace(flowWorkspace(3));
    expect(tierOf(index, 'flow_step', 'hierarchy')).toBe(HIERARCHY_TIERS.flow + 1);
    const n = neighbourhood(index, 'P-D-F01', 1);
    expect(isGrouped(index, 'P-D-F01')).toBe(false);
    expect(recordIds(n)).toEqual(expect.arrayContaining(['P-D-F01', 'P-D-F01-S01', 'P-D-F01-S02', 'P-D-F01-S03']));
    expect(spine(n)).toEqual(expect.arrayContaining(['P-D-F01 > P-D-F01-S01', 'P-D-F01 > P-D-F01-S02', 'P-D-F01 > P-D-F01-S03']));
    const tier = new Map(n.nodes.map((x) => [x.id, x.tier]));
    expect(tier.get('P-D-F01-S01')).toBeGreaterThan(tier.get('P-D-F01')!);
  });

  it('LA-BRW-T205 A flow with more than a handful of steps reaches them through a "Flow steps" group, folded until opened', () => {
    const index = indexWorkspace(flowWorkspace(6));
    expect(isGrouped(index, 'P-D-F01')).toBe(true);
    const gid = groupId('P-D-F01', 'flow_step');
    const folded = neighbourhood(index, 'P-D-F01', 1);
    const group = folded.nodes.find((x) => x.id === gid);
    expect(group).toMatchObject({ title: 'Flow steps (6)', group: { parent: 'P-D-F01', count: 6, open: false } });
    expect(group!.tier).toBe(HIERARCHY_TIERS.flow_step - 0.5);
    expect(recordIds(folded)).not.toContain('P-D-F01-S01');
    // Focusing a step opens its own group, which sits between the flow and the steps.
    const fromStep = neighbourhood(index, 'P-D-F01-S02', 1);
    expect(spine(fromStep)).toEqual(expect.arrayContaining([`P-D-F01 > ${gid}`, `${gid} > P-D-F01-S02`]));
  });

  it("LA-BRW-T206 A requirement's trace shows the step that fulfills it, the step's flow and the components the step uses", async () => {
    const index = indexWorkspace(flowWorkspace(3));
    const n = traceChain(index, 'P-D-UC01-R01');
    expect(recordIds(n)).toEqual(expect.arrayContaining(['P-D-F01', 'P-D-F01-S01', 'P-D-C01']));
    const edges = n.edges.map((e) => `${e.source} ${e.relation} ${e.target}`);
    expect(edges).toEqual(expect.arrayContaining(['P-D-F01-S01 fulfills P-D-UC01-R01', 'P-D-F01 parent P-D-F01-S01', 'P-D-F01-S01 uses P-D-C01']));
    // Steps that fulfill nothing are not in the trace.
    expect(recordIds(n)).not.toContain('P-D-F01-S02');
    const tier = new Map(n.nodes.map((x) => [x.id, x.tier]));
    expect(tier.get('P-D-F01-S01')).toBe(TRACE_TIERS.flow_step);
    expect(tier.get('P-D-F01')!).toBeLessThan(tier.get('P-D-F01-S01')!);
    expect(tier.get('P-D-F01-S01')!).toBeLessThan(tier.get('P-D-C01')!);
    // It still lays out in tiers.
    expect((await layoutNeighbourhood(n)).layout).toBe('layered');
  });
});
