import { describe, expect, it } from 'vitest';
import type { SpecData } from '../../../lathe/src/server/contract';
import { addRows, indexOf } from '../fixtures/load';
import { isGraphNode, neighborhood, nodeParent } from '../../src/graph/model';
import { graphMap } from '../../src/graph/map';
import { testIndex, testWorkspace } from './workspace';

// Flow steps in the graph: under their flow. A requirement's chain through its step is the Trace view's (test/trace).

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
  it('LA-V93-R31-T01 LA-V92-R12-T01 A flow step sits one column to the right of its flow, joined to it by the parent line', () => {
    const index = testIndex();
    const n = neighborhood(index, 'P-D-UC01-FL01', 2);
    expect(recordIds(n)).toEqual(expect.arrayContaining(['P-D-UC01-FL01', 'P-D-UC01-FL01-S01', 'P-D-UC01-FL01-S02', 'P-D-UC01-FL01-S03']));
    expect(spine(n)).toEqual(expect.arrayContaining(['P-D-UC01-FL01 > P-D-UC01-FL01-S01', 'P-D-UC01-FL01 > P-D-UC01-FL01-S02', 'P-D-UC01-FL01 > P-D-UC01-FL01-S03']));
    const column = new Map(n.nodes.map((x) => [x.id, x.column]));
    for (const step of ['P-D-UC01-FL01-S01', 'P-D-UC01-FL01-S02', 'P-D-UC01-FL01-S03']) expect(column.get(step)).toBe(column.get('P-D-UC01-FL01')! + 1);
  });

  it('LA-V93-R31-T02 LA-V92-R12-T02 A flow shows its steps directly, however many, and its flow test is listed in the test plan, not under it', () => {
    const index = indexOf(flowWorkspace(6));
    expect(spine(neighborhood(index, 'P-D-UC01-FL01', 1))).toEqual(expect.arrayContaining(['P-D-UC01-FL01 > P-D-UC01-FL01-S01', 'P-D-UC01-FL01 > P-D-UC01-FL01-S06']));
    expect(isGraphNode(index, 'P-D-UC01-FL01/flow_step')).toBe(false);
    // The flow sits in Interaction design's Flows folder, its test in Test plan's.
    expect(nodeParent(index, 'P-D-UC01-FL01')).toBe('P-D/interaction-design/flow');
    expect(nodeParent(index, 'P-D-UC01-FL01-T')).toBe('P-D/test-plan/flow_test');
    const map = graphMap(index, 'P');
    expect(map.nodes.get('P-D-UC01-FL01-S05')!.parent).toBe('P-D-UC01-FL01');
  });

});
