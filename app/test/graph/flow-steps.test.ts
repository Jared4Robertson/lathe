import { describe, expect, it } from 'vitest';
import type { SpecRecord, Workspace } from '../../../lathe/src/types';
import { groupId, isGrouped, neighborhood, TRACE_COLUMNS, traceChain } from '../../src/graph/model';
import { traceGrid } from '../../src/graph/layout';
import { graphMap } from '../../src/graph/map';
import { indexWorkspace } from '../../src/specs/data';
import { testWorkspace } from './workspace';

// Flow steps in the graph: under their flow, through a group like other children, and in traces.

function flowWorkspace(stepCount: number): Workspace {
  const w = testWorkspace();
  if (!w.kinds.some((k) => k.kind === 'flow_step')) {
    w.kinds.push({ kind: 'flow_step', label: 'Flow step', stage: 'design', section: 'interaction-design', parent_kinds: ['flow'], required_fields: ['order'], obligation: false, proof_only: false, description: 'One step of a flow.' });
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
  it('LA-BRW-T204 A flow step sits one column to the right of its flow, joined to it by the parent line', () => {
    const index = indexWorkspace(flowWorkspace(3));
    const n = neighborhood(index, 'P-D-F01', 2);
    expect(isGrouped(index, 'P-D-F01')).toBe(false);
    expect(recordIds(n)).toEqual(expect.arrayContaining(['P-D-F01', 'P-D-F01-S01', 'P-D-F01-S02', 'P-D-F01-S03']));
    expect(spine(n)).toEqual(expect.arrayContaining(['P-D-F01 > P-D-F01-S01', 'P-D-F01 > P-D-F01-S02', 'P-D-F01 > P-D-F01-S03']));
    const column = new Map(n.nodes.map((x) => [x.id, x.column]));
    for (const step of ['P-D-F01-S01', 'P-D-F01-S02', 'P-D-F01-S03']) expect(column.get(step)).toBe(column.get('P-D-F01')! + 1);
  });

  it('LA-BRW-T205 A flow with only steps shows them directly, however many; with another kind of child too it reaches them through a "Flow steps" group', () => {
    // Six steps and nothing else: one kind, so no group.
    const plain = indexWorkspace(flowWorkspace(6));
    expect(isGrouped(plain, 'P-D-F01')).toBe(false);
    expect(spine(neighborhood(plain, 'P-D-F01', 1))).toEqual(expect.arrayContaining(['P-D-F01 > P-D-F01-S01', 'P-D-F01 > P-D-F01-S06']));
    // An interaction requirement on the flow makes two kinds of child.
    const w = flowWorkspace(6);
    if (!w.kinds.some((k) => k.kind === 'interaction_requirement')) {
      w.kinds.push({ kind: 'interaction_requirement', label: 'Interaction requirement', stage: 'design', section: 'interaction-design', parent_kinds: ['view', 'endpoint', 'flow'], required_fields: [], obligation: true, proof_only: false, description: 'One rule a view, endpoint or flow must follow.' });
    }
    w.records.push({ id: 'P-D-F01-IR01', kind: 'interaction_requirement', title: 'Each step saves', parent: 'P-D-F01', fields: {}, body: '', product: 'P', domain: 'P-D', path: 'specs/P-D-F01-IR01.md', mentions: [] });
    const index = indexWorkspace(w);
    expect(isGrouped(index, 'P-D-F01')).toBe(true);
    const gid = groupId('P-D-F01', 'flow_step');
    const folded = neighborhood(index, 'P-D-F01', 1);
    const group = folded.nodes.find((x) => x.id === gid);
    expect(group).toMatchObject({ title: 'Flow steps (6)', group: { parent: 'P-D-F01', count: 6 } });
    expect(group!.column).toBe(folded.nodes.find((x) => x.id === 'P-D-F01')!.column + 1);
    // At depth 1 the group is the last level framed; its steps are the next, at depth 2.
    expect(recordIds(folded)).not.toContain('P-D-F01-S01');
    expect(recordIds(neighborhood(index, 'P-D-F01', 2))).toContain('P-D-F01-S01');
    // From a step, its group is the parent at the left edge, and in the map the group sits between the flow and the steps.
    expect(spine(neighborhood(index, 'P-D-F01-S02', 1))).toEqual([`${gid} > P-D-F01-S02`]);
    const map = graphMap(index);
    expect(map.nodes.get('P-D-F01-S02')!.parent).toBe(gid);
    expect(map.nodes.get(gid)!.parent).toBe('P-D-F01');
  });

  it("LA-BRW-T206 A requirement's trace shows the step that fulfills it, the step's flow and the components the step uses", async () => {
    const index = indexWorkspace(flowWorkspace(3));
    const n = traceChain(index, 'P-D-UC01-R01');
    expect(recordIds(n)).toEqual(expect.arrayContaining(['P-D-F01', 'P-D-F01-S01', 'P-D-C01']));
    const edges = n.edges.map((e) => `${e.source} ${e.relation} ${e.target}`);
    expect(edges).toEqual(expect.arrayContaining(['P-D-F01-S01 fulfills P-D-UC01-R01', 'P-D-F01 parent P-D-F01-S01', 'P-D-F01-S01 uses P-D-C01']));
    // Steps that fulfill nothing are not in the trace.
    expect(recordIds(n)).not.toContain('P-D-F01-S02');
    const column = new Map(n.nodes.map((x) => [x.id, x.column]));
    expect(column.get('P-D-F01-S01')).toBe(TRACE_COLUMNS.flow_step);
    expect(column.get('P-D-F01')!).toBeLessThan(column.get('P-D-F01-S01')!);
    expect(column.get('P-D-F01-S01')!).toBeLessThan(column.get('P-D-C01')!);
    // It lays out in columns, left to right.
    const { positions } = traceGrid(n);
    expect(positions.get('P-D-F01')!.x).toBeLessThan(positions.get('P-D-F01-S01')!.x);
    expect(positions.get('P-D-F01-S01')!.x).toBeLessThan(positions.get('P-D-C01')!.x);
  });
});
