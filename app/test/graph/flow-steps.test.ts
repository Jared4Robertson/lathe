import { describe, expect, it } from 'vitest';
import type { SpecData } from '../../../lathe/src/server/contract';
import { addRows, indexOf } from '../fixtures/load';
import { groupId, isGrouped, neighborhood, TRACE_COLUMNS, traceChain } from '../../src/graph/model';
import { traceGrid } from '../../src/graph/layout';
import { graphMap } from '../../src/graph/map';
import { testWorkspace } from './workspace';

// Flow steps in the graph: under their flow, through a group like other children, and in traces.

function flowWorkspace(stepCount: number): SpecData {
  const w = testWorkspace();
  addRows(w, 'flow', { id: 'P-D-F01', title: 'Lend a thing', domain_id: 'P-D' });
  addRows(w, 'carries_out', { source_id: 'P-D-F01', target_id: 'P-D-UC01' });
  for (let i = 1; i <= stepCount; i++) {
    const id = `P-D-F01-S0${i}`;
    addRows(w, 'flow_step', { id, title: `Step ${i}`, flow_id: 'P-D-F01', path: 'main', position: i });
    addRows(w, 'uses', { source_id: id, target_id: 'P-D-V01' });
  }
  // The first step fulfills the requirement and is carried out by the service.
  addRows(w, 'fulfills', { source_id: 'P-D-F01-S01', target_id: 'P-D-UC01-R01' });
  addRows(w, 'uses', { source_id: 'P-D-F01-S01', target_id: 'P-D-C01' });
  return w;
}

const recordIds = (n: { nodes: { id: string; group?: unknown }[] }) => n.nodes.filter((x) => !x.group).map((x) => x.id).sort();
const spine = (n: { edges: { source: string; target: string; relation: string }[] }) =>
  n.edges.filter((e) => e.relation === 'parent').map((e) => `${e.source} > ${e.target}`).sort();

describe('flow steps in the graph', () => {
  it('LA-EXP-T67 A flow step sits one column to the right of its flow, joined to it by the parent line', () => {
    const index = indexOf(flowWorkspace(3));
    const n = neighborhood(index, 'P-D-F01', 2);
    expect(isGrouped(index, 'P-D-F01')).toBe(false);
    expect(recordIds(n)).toEqual(expect.arrayContaining(['P-D-F01', 'P-D-F01-S01', 'P-D-F01-S02', 'P-D-F01-S03']));
    expect(spine(n)).toEqual(expect.arrayContaining(['P-D-F01 > P-D-F01-S01', 'P-D-F01 > P-D-F01-S02', 'P-D-F01 > P-D-F01-S03']));
    const column = new Map(n.nodes.map((x) => [x.id, x.column]));
    for (const step of ['P-D-F01-S01', 'P-D-F01-S02', 'P-D-F01-S03']) expect(column.get(step)).toBe(column.get('P-D-F01')! + 1);
  });

  it('LA-EXP-T68 A flow with only steps shows them directly, however many; with another kind of child too it reaches them through a "Flow steps" group', () => {
    // Six steps and nothing else: one kind, so no group.
    const plain = indexOf(flowWorkspace(6));
    expect(isGrouped(plain, 'P-D-F01')).toBe(false);
    expect(spine(neighborhood(plain, 'P-D-F01', 1))).toEqual(expect.arrayContaining(['P-D-F01 > P-D-F01-S01', 'P-D-F01 > P-D-F01-S06']));
    // An interaction requirement on the flow makes two kinds of child.
    const w = flowWorkspace(6);
    addRows(w, 'interaction_requirement', { id: 'P-D-F01-IR01', title: 'Each step saves', domain_id: 'P-D', flow_id: 'P-D-F01', statement: 'Each step MUST save.' });
    const index = indexOf(w);
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
    const map = graphMap(index, 'P');
    expect(map.nodes.get('P-D-F01-S02')!.parent).toBe(gid);
    expect(map.nodes.get(gid)!.parent).toBe('P-D-F01');
  });

  it("LA-EXP-T69 A requirement's trace shows the step that fulfills it, the step's flow and the components the step uses", async () => {
    const index = indexOf(flowWorkspace(3));
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
