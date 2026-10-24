import { describe, expect, it } from 'vitest';
import { canTrace, fileNodeId, HIERARCHY_TIERS, neighbourhood, nextTrail, sameTierCycle, tierOf, traceChain, type Filters } from '../../src/graph/model';
import { indexWorkspace } from '../../src/specs/data';
import { layoutNeighbourhood, NODE_HEIGHT, NODE_WIDTH } from '../../src/graph/layout';
import { testIndex, testWorkspace } from './workspace';

const ids = (n: { nodes: { id: string }[] }) => n.nodes.map((x) => x.id).sort();
const filters = (kinds: string[] = [], relations: string[] = []): Filters => ({ hiddenKinds: new Set(kinds), hiddenRelations: new Set(relations) });

describe('graph neighbourhood', () => {
  const index = testIndex();

  it('LA-BRW-T50 At depth 1 the graph shows the record and every record one link or parent step away, both ways', () => {
    const n = neighbourhood(index, 'P-D-UC01-R01', 1);
    expect(n.nodes[0]).toMatchObject({ id: 'P-D-UC01-R01', distance: 0 });
    expect(ids(n)).toEqual(['P-D-C01', 'P-D-T01', 'P-D-UC01', 'P-D-UC01-R01', 'P-D-V01']);
    // Every edge between shown records, including the one between two neighbours.
    expect(n.edges.map((e) => `${e.source} ${e.relation} ${e.target}`).sort()).toEqual([
      'P-D-C01 implements P-D-V01',
      'P-D-C01 satisfies P-D-UC01-R01',
      'P-D-T01 proves P-D-UC01-R01',
      'P-D-UC01 parent P-D-UC01-R01',
      'P-D-V01 fulfills P-D-UC01-R01',
    ]);
    // Outgoing links and children are followed too.
    expect(ids(neighbourhood(index, 'P-D-C01', 1))).toEqual(['P-D', 'P-D-C01', 'P-D-C02', 'P-D-DR01', 'P-D-UC01-R01', 'P-D-V01']);
    expect(ids(neighbourhood(index, 'P-D-A1', 1))).toEqual(['P-D', 'P-D-A1', 'P-D-DR01', 'P-D-DR02', 'P-D-Q01']);
  });

  it('LA-BRW-T51 At depth 2 the graph adds the records two steps away, each at its distance', () => {
    const n = neighbourhood(index, 'P-D-UC01-R01', 2);
    expect(ids(n)).toEqual(['P-D', 'P-D-C01', 'P-D-C02', 'P-D-DR01', 'P-D-E01', 'P-D-T01', 'P-D-UC01', 'P-D-UC01-R01', 'P-D-V01']);
    const distance = new Map(n.nodes.map((x) => [x.id, x.distance]));
    expect(distance.get('P-D-E01')).toBe(2);
    expect(distance.get('P-D-V01')).toBe(1);
    // Every node but the focus records the node it was reached from.
    expect(n.via.size).toBe(n.nodes.length - 1);
    expect(n.via.get('P-D-E01')).toBe('P-D-V01');
    // The order is stable: focus first, then by distance.
    expect(n.nodes.map((x) => x.distance)).toEqual([...n.nodes.map((x) => x.distance)].sort());
    expect(neighbourhood(index, 'P-D-UC01-R01', 2)).toEqual(n);
  });

  it('LA-BRW-T52 Filters hide kinds and relations, nothing is reached through them, and the focus is never hidden', () => {
    expect(ids(neighbourhood(index, 'P-D-UC01-R01', 1, filters(['test'])))).not.toContain('P-D-T01');
    // Hiding satisfies keeps the component out at depth 1 and drops its satisfies edge.
    const noSatisfies = neighbourhood(index, 'P-D-UC01-R01', 1, filters([], ['satisfies']));
    expect(ids(noSatisfies)).not.toContain('P-D-C01');
    expect(noSatisfies.edges.some((e) => e.relation === 'satisfies')).toBe(false);
    // At depth 2 the component comes back through the view it implements, still without the hidden edge.
    const deep = neighbourhood(index, 'P-D-UC01-R01', 2, filters([], ['satisfies']));
    expect(ids(deep)).toContain('P-D-C01');
    expect(deep.edges.some((e) => e.relation === 'satisfies')).toBe(false);
    // Hiding views means the endpoint is not reached through one.
    expect(ids(neighbourhood(index, 'P-D-UC01-R01', 2, filters(['view', 'domain', 'component'])))).not.toContain('P-D-E01');
    // The focus stays even when its own kind is hidden.
    expect(ids(neighbourhood(index, 'P-D-UC01-R01', 1, filters(['requirement'])))).toContain('P-D-UC01-R01');
    // Only satisfies and proves.
    const trace = neighbourhood(index, 'P-D-UC01-R01', 2, filters([], ['parent', 'fulfills', 'implements', 'uses', 'applies', 'depends_on', 'relates_to', 'about']));
    expect(ids(trace)).toEqual(['P-D-C01', 'P-D-DR01', 'P-D-T01', 'P-D-UC01-R01']);
  });

  it('LA-BRW-T53 Trace mode shows what fulfills, satisfies and proves a requirement, and the files they name', () => {
    const t = traceChain(index, 'P-D-UC01-R01');
    expect(ids(t)).toEqual([fileNodeId('src/thing.ts'), fileNodeId('test/thing.test.ts'), 'P-D-C01', 'P-D-T01', 'P-D-UC01-R01', 'P-D-V01'].sort());
    expect(t.edges.map((e) => `${e.source} ${e.relation} ${e.target}`).sort()).toEqual([
      'P-D-C01 implements P-D-V01',
      'P-D-C01 names file:src/thing.ts',
      'P-D-C01 satisfies P-D-UC01-R01',
      'P-D-T01 names file:test/thing.test.ts',
      'P-D-T01 proves P-D-UC01-R01',
      'P-D-V01 fulfills P-D-UC01-R01',
    ]);
    // The parent use case and other neighbours are not part of the chain.
    expect(ids(t)).not.toContain('P-D-UC01');
    // A rule's chain; a rule nobody satisfies or proves has only itself.
    expect(ids(traceChain(index, 'P-D-DR01'))).toEqual([fileNodeId('src/thing.ts'), 'P-D-C01', 'P-D-DR01'].sort());
    expect(ids(traceChain(index, 'P-D-DR02'))).toEqual(['P-D-DR02']);
    // Filters apply to the chain too.
    expect(ids(traceChain(index, 'P-D-UC01-R01', filters(['test', 'file'])))).toEqual(['P-D-C01', 'P-D-UC01-R01', 'P-D-V01']);
  });

  it('LA-BRW-T54 Trace mode is offered only for requirements and domain rules', () => {
    expect(canTrace(index, 'P-D-UC01-R01')).toBe(true);
    expect(canTrace(index, 'P-D-DR01')).toBe(true);
    for (const id of ['P', 'P-D', 'P-D-UC01', 'P-D-C01', 'P-D-T01', 'P-D-V01', 'missing']) expect(canTrace(index, id)).toBe(false);
    expect(traceChain(index, 'P-D-UC01').nodes).toEqual([]);
  });

  it('LA-BRW-T55 The layout gives the same picture every time, with the focus at the centre and no overlaps', async () => {
    const n = neighbourhood(index, 'P-D-UC01-R01', 2);
    const { positions, layout } = await layoutNeighbourhood(n);
    expect(layout).toBe('layered');
    expect(positions.get('P-D-UC01-R01')).toEqual({ x: -NODE_WIDTH / 2, y: -NODE_HEIGHT / 2 });
    expect(positions.size).toBe(n.nodes.length);
    const boxes = [...positions.values()];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const overlap = Math.abs(boxes[i].x - boxes[j].x) < NODE_WIDTH && Math.abs(boxes[i].y - boxes[j].y) < NODE_HEIGHT;
      expect(overlap).toBe(false);
    }
    expect((await layoutNeighbourhood(neighbourhood(index, 'P-D-UC01-R01', 2))).positions).toEqual(positions);
    // Re-centring on a neighbour keeps the order within a tier.
    const fromView = (await layoutNeighbourhood(neighbourhood(index, 'P-D-V01', 2))).positions;
    const xOrder = (ps: Map<string, { x: number }>, list: string[]) => [...list].sort((a, b) => ps.get(a)!.x - ps.get(b)!.x);
    const design = ['P-D-C01', 'P-D-V01'];
    expect(xOrder(fromView, design)).toEqual(xOrder(positions, design));
    // A single record sits at the centre on its own.
    expect((await layoutNeighbourhood(traceChain(index, 'P-D-DR02'))).positions.get('P-D-DR02')).toEqual({ x: -NODE_WIDTH / 2, y: -NODE_HEIGHT / 2 });
  });

  it('LA-BRW-T56 The breadcrumb trail adds each record visited and cuts back when a visited record is revisited', () => {
    expect(nextTrail([], 'A')).toEqual(['A']);
    expect(nextTrail(['A'], 'B')).toEqual(['A', 'B']);
    expect(nextTrail(['A', 'B', 'C'], 'B')).toEqual(['A', 'B']);
    expect(nextTrail(['A', 'B'], 'B')).toEqual(['A', 'B']);
    expect(nextTrail(['1', '2', '3'], '4', 3)).toEqual(['2', '3', '4']);
  });

  it('LA-BRW-T63 Each kind gets the tier of its level in the hierarchy, and trace mode has its own columns', () => {
    const tier = (kind: string) => tierOf(index, kind, 'hierarchy');
    expect(['product', 'domain', 'aggregate', 'domain_rule', 'flow', 'test'].map(tier)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(tier('use_case')).toBe(tier('aggregate'));
    expect(tier('requirement')).toBe(tier('domain_rule'));
    for (const k of ['view', 'endpoint', 'component']) expect(tier(k)).toBe(tier('flow'));
    // Every kind sits below its parent kinds, except a question, which sits with what it is about.
    for (const k of index.workspace.kinds.filter((k) => k.kind !== 'question')) {
      for (const parent of k.parent_kinds) expect(tier(parent)).toBeLessThan(tier(k.kind));
    }
    // Trace columns, left to right.
    const trace = (kind: string) => tierOf(index, kind, 'trace');
    expect(['requirement', 'view', 'component', 'test', 'file'].map(trace)).toEqual([0, 1, 2, 3, 4]);
    expect(trace('domain_rule')).toBe(0);
    expect(trace('flow')).toBe(trace('endpoint'));
    // A kind a product adds goes one tier below its highest parent.
    const base = testWorkspace();
    const extra = indexWorkspace({ ...base, kinds: [...base.kinds, { kind: 'scenario', label: 'Scenario', stage: 'define', parent_kinds: ['use_case'], required_fields: [], description: '' }] });
    expect(tierOf(extra, 'scenario', 'hierarchy')).toBe(HIERARCHY_TIERS.use_case + 1);
    // Nodes carry their tier.
    expect(neighbourhood(index, 'P-D-UC01-R01', 1).nodes.find((x) => x.id === 'P-D-T01')!.tier).toBe(5);
  });

  it('LA-BRW-T64 The graph reads top to bottom by tier, and a trace reads left to right', async () => {
    const n = neighbourhood(index, 'P-D-UC01-R01', 2);
    const { positions } = await layoutNeighbourhood(n);
    const y = (id: string) => positions.get(id)!.y;
    // One row per tier, rows in tier order.
    const rows = new Map<number, Set<number>>();
    for (const node of n.nodes) rows.set(node.tier, (rows.get(node.tier) ?? new Set()).add(y(node.id)));
    for (const ys of rows.values()) expect(ys.size).toBe(1);
    const tiers = [...rows.keys()].sort((a, b) => a - b);
    for (let i = 1; i < tiers.length; i++) expect([...rows.get(tiers[i])!][0]).toBeGreaterThan([...rows.get(tiers[i - 1])!][0]);
    // Ancestors above the focus, design records and tests below it.
    expect(y('P-D')).toBeLessThan(y('P-D-UC01'));
    expect(y('P-D-UC01')).toBeLessThan(y('P-D-UC01-R01'));
    expect(y('P-D-UC01-R01')).toBeLessThan(y('P-D-C01'));
    expect(y('P-D-C01')).toBeLessThan(y('P-D-T01'));
    expect(y('P-D-DR01')).toBe(y('P-D-UC01-R01'));

    const traced = (await layoutNeighbourhood(traceChain(index, 'P-D-UC01-R01'))).positions;
    const x = (id: string) => traced.get(id)!.x;
    expect(x('P-D-UC01-R01')).toBeLessThan(x('P-D-V01'));
    expect(x('P-D-V01')).toBeLessThan(x('P-D-C01'));
    expect(x('P-D-C01')).toBeLessThan(x('P-D-T01'));
    expect(x('P-D-T01')).toBeLessThan(x('file:test/thing.test.ts'));
    expect(x('file:src/thing.ts')).toBe(x('file:test/thing.test.ts'));
  });

  it('LA-BRW-T65 A cycle among records in one tier falls back to a radial layout that names the cycle', async () => {
    const w = testWorkspace();
    w.records.push({ ...w.records.find((r) => r.id === 'P-D-A1')!, id: 'P-D-A2', title: 'Owner', path: 'specs/P-D-A2.md' });
    w.links.push({ source: 'P-D-A1', relation: 'relates_to', target: 'P-D-A2' }, { source: 'P-D-A2', relation: 'relates_to', target: 'P-D-A1' });
    const n = neighbourhood(indexWorkspace(w), 'P-D-A1', 1);
    expect(sameTierCycle(n)).toEqual(['P-D-A1', 'P-D-A2']);
    const placed = await layoutNeighbourhood(n);
    expect(placed.layout).toBe('radial');
    expect(placed.cycle).toEqual(['P-D-A1', 'P-D-A2']);
    expect(placed.positions.get('P-D-A1')).toEqual({ x: -NODE_WIDTH / 2, y: -NODE_HEIGHT / 2 });
    // One link between aggregates is not a cycle: still tiers.
    w.links.pop();
    const n2 = neighbourhood(indexWorkspace(w), 'P-D-A1', 1);
    expect(sameTierCycle(n2)).toBeNull();
    expect((await layoutNeighbourhood(n2)).layout).toBe('layered');
    // Links across tiers never count as a cycle.
    expect(sameTierCycle(neighbourhood(index, 'P-D-UC01-R01', 2))).toBeNull();
  });
});
