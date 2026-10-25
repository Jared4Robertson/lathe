import { describe, expect, it } from 'vitest';
import { canTrace, fileNodeId, neighbourhood, nextTrail, TRACE_COLUMNS, traceChain, traceColumn, type Filters } from '../../src/graph/model';
import { indexWorkspace } from '../../src/specs/data';
import { layeredGraph, layoutNeighbourhood, NODE_HEIGHT, NODE_WIDTH } from '../../src/graph/layout';
import { testIndex, testWorkspace } from './workspace';

const ids = (n: { nodes: { id: string }[] }) => n.nodes.map((x) => x.id).sort();
const recordIds = (n: { nodes: { id: string; group?: unknown }[] }) => n.nodes.filter((x) => !x.group).map((x) => x.id).sort();
const groupIds = (n: { nodes: { id: string; group?: unknown }[] }) => n.nodes.filter((x) => x.group).map((x) => x.id).sort();
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
    // The domain is reached through the components' group; the view's group joins the spine too.
    expect(groupIds(neighbourhood(index, 'P-D-C01', 1))).toEqual(['P-D/component', 'P-D/view']);
    expect(recordIds(neighbourhood(index, 'P-D-C01', 1))).toEqual(['P-D', 'P-D-C01', 'P-D-C02', 'P-D-DR01', 'P-D-UC01-R01', 'P-D-V01']);
    expect(recordIds(neighbourhood(index, 'P-D-A1', 1))).toEqual(['P-D', 'P-D-A1', 'P-D-DR01', 'P-D-DR02', 'P-D-Q01']);
  });

  it('LA-BRW-T51 At depth 2 the graph adds the records two steps away, each at its distance', () => {
    const n = neighbourhood(index, 'P-D-UC01-R01', 2);
    expect(groupIds(n)).toEqual(['P-D/component', 'P-D/endpoint', 'P-D/test', 'P-D/use_case', 'P-D/view']);
    expect(recordIds(n)).toEqual(['P-D', 'P-D-C01', 'P-D-C02', 'P-D-DR01', 'P-D-E01', 'P-D-T01', 'P-D-UC01', 'P-D-UC01-R01', 'P-D-V01']);
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
    // Re-centring on a neighbour keeps the order within a column.
    const fromView = (await layoutNeighbourhood(neighbourhood(index, 'P-D-V01', 2))).positions;
    const yOrder = (ps: Map<string, { y: number }>, list: string[]) => [...list].sort((a, b) => ps.get(a)!.y - ps.get(b)!.y);
    const siblings = ['P-D-UC01', 'P-D-V01', 'P-D-E01', 'P-D-C01', 'P-D-T01'];
    expect(new Set(siblings.map((id) => positions.get(id)!.x)).size).toBe(1);
    expect(yOrder(fromView, siblings)).toEqual(yOrder(positions, siblings));
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

  it('LA-BRW-T63 Columns follow the parent/child tree around the focus, and trace mode has its own columns', () => {
    const n = neighbourhood(index, 'P-D-UC01-R01', 2);
    const column = new Map(n.nodes.map((x) => [x.id, x.column]));
    // Ancestors one column each to the left, the leftmost column is 0.
    expect(['P-D', 'P-D/use_case', 'P-D-UC01', 'P-D-UC01-R01'].map((id) => column.get(id))).toEqual([0, 1, 2, 3]);
    // The domain's other children sit with the use case, whatever their kind (their tree position wins over the cross-link).
    for (const id of ['P-D-C01', 'P-D-T01', 'P-D-V01', 'P-D-E01']) expect(column.get(id)).toBe(column.get('P-D-UC01'));
    for (const id of ['P-D/component', 'P-D/test', 'P-D/view', 'P-D/endpoint']) expect(column.get(id)).toBe(column.get('P-D/use_case'));
    // Every node's parent line runs from one column to the next.
    for (const e of n.edges.filter((e) => e.relation === 'parent')) expect(column.get(e.target)).toBe(column.get(e.source)! + 1);
    // Trace columns, left to right; a kind a product adds goes with the components.
    expect(['requirement', 'view', 'component', 'test', 'file'].map(traceColumn)).toEqual([0, 1, 2, 3, 4]);
    expect(traceColumn('domain_rule')).toBe(0);
    expect(traceColumn('flow')).toBe(traceColumn('endpoint'));
    expect(traceColumn('scenario')).toBe(TRACE_COLUMNS.component);
    const t = traceChain(index, 'P-D-UC01-R01');
    for (const node of t.nodes) expect(node.column).toBe(traceColumn(node.kind));
  });

  it('LA-BRW-T64 The graph reads left to right by column, and so does a trace', async () => {
    const n = neighbourhood(index, 'P-D-UC01-R01', 2);
    const { positions } = await layoutNeighbourhood(n);
    const col = (id: string) => positions.get(id)!.x;
    // One x per column, columns in order.
    const columns = new Map<number, Set<number>>();
    for (const node of n.nodes) columns.set(node.column, (columns.get(node.column) ?? new Set()).add(col(node.id)));
    for (const xs of columns.values()) expect(xs.size).toBe(1);
    const order = [...columns.keys()].sort((a, b) => a - b);
    for (let i = 1; i < order.length; i++) expect([...columns.get(order[i])!][0]).toBeGreaterThan([...columns.get(order[i - 1])!][0]);
    // Ancestors to the left of the focus.
    expect(col('P-D')).toBeLessThan(col('P-D/use_case'));
    expect(col('P-D/use_case')).toBeLessThan(col('P-D-UC01'));
    expect(col('P-D-UC01')).toBeLessThan(col('P-D-UC01-R01'));
    // At depth 1 the domain is not shown, so what satisfies, fulfills and proves the requirement sits one column to its right.
    const near = (await layoutNeighbourhood(neighbourhood(index, 'P-D-UC01-R01', 1))).positions;
    for (const id of ['P-D-C01', 'P-D-T01', 'P-D-V01']) expect(near.get(id)!.x).toBeGreaterThan(near.get('P-D-UC01-R01')!.x);

    const traced = (await layoutNeighbourhood(traceChain(index, 'P-D-UC01-R01'))).positions;
    const x = (id: string) => traced.get(id)!.x;
    expect(x('P-D-UC01-R01')).toBeLessThan(x('P-D-V01'));
    expect(x('P-D-V01')).toBeLessThan(x('P-D-C01'));
    expect(x('P-D-C01')).toBeLessThan(x('P-D-T01'));
    expect(x('P-D-T01')).toBeLessThan(x('file:test/thing.test.ts'));
    expect(x('file:src/thing.ts')).toBe(x('file:test/thing.test.ts'));
  });

  it('LA-BRW-T65 Links between records in one column, even in a ring, are drawn but never stop the layout in columns', async () => {
    const w = testWorkspace();
    w.records.push({ ...w.records.find((r) => r.id === 'P-D-A1')!, id: 'P-D-A2', title: 'Owner', path: 'specs/P-D-A2.md' });
    w.links.push({ source: 'P-D-A1', relation: 'relates_to', target: 'P-D-A2' }, { source: 'P-D-A2', relation: 'relates_to', target: 'P-D-A1' });
    const n = neighbourhood(indexWorkspace(w), 'P-D-A1', 2);
    const column = new Map(n.nodes.map((x) => [x.id, x.column]));
    // The two aggregates are siblings, so they share a column, and both links are drawn.
    expect(column.get('P-D-A2')).toBe(column.get('P-D-A1'));
    expect(n.edges.filter((e) => e.relation === 'relates_to')).toHaveLength(2);
    // Neither link reaches the layout, which stays in columns.
    const pairs = (layeredGraph(n).edges ?? []).map((e) => `${e.sources[0]}>${e.targets[0]}`);
    expect(pairs.some((p) => p.includes('P-D-A1') && p.includes('P-D-A2'))).toBe(false);
    const placed = await layoutNeighbourhood(n);
    expect(placed.layout).toBe('layered');
    expect(placed.cycle).toBeNull();
    expect(placed.positions.get('P-D-A2')!.x).toBe(placed.positions.get('P-D-A1')!.x);
  });
});
