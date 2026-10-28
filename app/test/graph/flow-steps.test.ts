import { describe, expect, it } from 'vitest';
import type { SpecData } from '../../../lathe/src/server/contract';
import { addRows, indexOf } from '../fixtures/load';
import { isGraphNode, neighborhood, nodeParent, TRACE_COLUMNS, traceChain } from '../../src/graph/model';
import { traceGrid } from '../../src/graph/layout';
import { graphMap } from '../../src/graph/map';
import { testIndex, testWorkspace } from './workspace';

// Flow steps in the graph: under their flow, and in traces.

/** The test workspace with more steps on the main path of P-D-UC01's flow, up to `stepCount`. */
function flowWorkspace(stepCount: number): SpecData {
  const w = testWorkspace();
  for (let i = 4; i <= stepCount; i++) {
    addRows(w, 'flow_step', { id: `P-D-UC01-FL01-S0${i}`, title: `Step ${i}`, flow_id: 'P-D-UC01-FL01', path: 'main', position: i - 1 });
  }
  return w;
}

const recordIds = (n: { nodes: { id: string; group?: unknown }[] }) => n.nodes.filter((x) => !x.group).map((x) => x.id).sort();
const spine = (n: { edges: { source: string; target: string; relation: string }[] }) =>
  n.edges.filter((e) => e.relation === 'parent').map((e) => `${e.source} > ${e.target}`).sort();

describe('flow steps in the graph', () => {
  it.each(['LA-V93-R31-T01', 'LA-V92-R12-T01'])('%s A flow step sits one column to the right of its flow, joined to it by the parent line', () => {
    const index = testIndex();
    const n = neighborhood(index, 'P-D-UC01-FL01', 2);
    expect(recordIds(n)).toEqual(expect.arrayContaining(['P-D-UC01-FL01', 'P-D-UC01-FL01-S01', 'P-D-UC01-FL01-S02', 'P-D-UC01-FL01-S03']));
    expect(spine(n)).toEqual(expect.arrayContaining(['P-D-UC01-FL01 > P-D-UC01-FL01-S01', 'P-D-UC01-FL01 > P-D-UC01-FL01-S02', 'P-D-UC01-FL01 > P-D-UC01-FL01-S03']));
    const column = new Map(n.nodes.map((x) => [x.id, x.column]));
    for (const step of ['P-D-UC01-FL01-S01', 'P-D-UC01-FL01-S02', 'P-D-UC01-FL01-S03']) expect(column.get(step)).toBe(column.get('P-D-UC01-FL01')! + 1);
  });

  it.each(['LA-V93-R31-T02', 'LA-V92-R12-T02'])('%s A flow shows its steps directly, however many, and its flow test is listed in the test plan, not under it', () => {
    const index = indexOf(flowWorkspace(6));
    expect(spine(neighborhood(index, 'P-D-UC01-FL01', 1))).toEqual(expect.arrayContaining(['P-D-UC01-FL01 > P-D-UC01-FL01-S01', 'P-D-UC01-FL01 > P-D-UC01-FL01-S06']));
    expect(isGraphNode(index, 'P-D-UC01-FL01/flow_step')).toBe(false);
    // The flow sits in Interaction design's Flows folder, its test in Test plan's.
    expect(nodeParent(index, 'P-D-UC01-FL01')).toBe('P-D/interaction-design/flow');
    expect(nodeParent(index, 'P-D-UC01-FL01-T')).toBe('P-D/test-plan/flow_test');
    const map = graphMap(index, 'P');
    expect(map.nodes.get('P-D-UC01-FL01-S05')!.parent).toBe('P-D-UC01-FL01');
  });

  it.each(['LA-V93-R32-T01', 'LA-V93-R09-T01'])("%s A UC requirement's trace shows the step that fulfills it, the step's flow, what the step invokes and that operation's handler", async () => {
    const index = testIndex();
    const n = traceChain(index, 'P-D-UC01-R01');
    expect(recordIds(n)).toEqual(expect.arrayContaining(['P-D-UC01-FL01', 'P-D-UC01-FL01-S01', 'P-D-CMD01', 'P-D-CMD01-H']));
    const edges = n.edges.map((e) => `${e.source} ${e.relation} ${e.target}`);
    expect(edges).toEqual(expect.arrayContaining(['P-D-UC01-FL01-S01 fulfills P-D-UC01-R01', 'P-D-UC01-FL01 parent P-D-UC01-FL01-S01', 'P-D-UC01-FL01-S01 invokes P-D-CMD01']));
    // Steps that fulfill nothing are not in the trace.
    expect(recordIds(n)).not.toContain('P-D-UC01-FL01-S02');
    const column = new Map(n.nodes.map((x) => [x.id, x.column]));
    expect(column.get('P-D-UC01-FL01-S01')).toBe(TRACE_COLUMNS.step);
    expect(column.get('P-D-UC01-FL01')!).toBeLessThan(column.get('P-D-UC01-FL01-S01')!);
    expect(column.get('P-D-UC01-FL01-S01')!).toBeLessThan(column.get('P-D-CMD01')!);
    expect(column.get('P-D-CMD01')!).toBeLessThan(column.get('P-D-CMD01-H')!);
    // It lays out in columns, left to right.
    const { positions } = traceGrid(n);
    expect(positions.get('P-D-UC01-FL01')!.x).toBeLessThan(positions.get('P-D-UC01-FL01-S01')!.x);
    expect(positions.get('P-D-UC01-FL01-S01')!.x).toBeLessThan(positions.get('P-D-CMD01')!.x);
  });
});
