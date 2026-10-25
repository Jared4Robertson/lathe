import { describe, expect, it } from 'vitest';
import { canTrace, fileNodeId, neighborhood, nextTrail, TRACE_COLUMNS, traceChain, traceColumn, type Filters } from '../../src/graph/model';
import { indexWorkspace } from '../../src/specs/data';
import { layoutNeighborhood, NODE_HEIGHT, NODE_WIDTH } from '../../src/graph/layout';
import { testIndex, testWorkspace } from './workspace';

const ids = (n: { nodes: { id: string }[] }) => n.nodes.map((x) => x.id).sort();
const focusIds = (n: { nodes: { id: string; context?: boolean }[] }) => n.nodes.filter((x) => !x.context).map((x) => x.id).sort();
const contextIds = (n: { nodes: { id: string; context?: boolean }[] }) => n.nodes.filter((x) => x.context).map((x) => x.id).sort();
const filters = (kinds: string[] = [], relations: string[] = []): Filters => ({ hiddenKinds: new Set(kinds), hiddenRelations: new Set(relations) });

describe('graph neighborhood', () => {
  const index = testIndex();

  it('LA-BRW-T50 Depth counts levels of the tree each way, stages and folders included; siblings and links are not added', () => {
    // Depth 1: the requirement, its use case above; the use case's folder is the next ring out, faded.
    const one = neighborhood(index, 'P-D-UC01-R01', 1);
    expect(one.nodes[0]).toMatchObject({ id: 'P-D-UC01-R01', distance: 0 });
    expect(focusIds(one)).toEqual(['P-D-UC01', 'P-D-UC01-R01']);
    expect(contextIds(one)).toEqual(['P-D/define/use-cases']);
    // Depth 2 and 3 climb a level more each: the Capabilities folder, then Define; the ring is one more out.
    const two = neighborhood(index, 'P-D-UC01-R01', 2);
    expect(focusIds(two)).toEqual(['P-D-UC01', 'P-D-UC01-R01', 'P-D/define/use-cases']);
    expect(contextIds(two)).toEqual(['P-D/define']);
    const three = neighborhood(index, 'P-D-UC01-R01', 3);
    expect(focusIds(three)).toEqual(['P-D-UC01', 'P-D-UC01-R01', 'P-D/define', 'P-D/define/use-cases']);
    expect(contextIds(three)).toEqual(['P-D']);
    // Each node at its level, reached from the one below it.
    const distance = new Map(three.nodes.map((x) => [x.id, x.distance]));
    expect(['P-D-UC01', 'P-D/define/use-cases', 'P-D/define', 'P-D'].map((id) => distance.get(id))).toEqual([1, 2, 3, 4]);
    expect(three.via.get('P-D/define')).toBe('P-D/define/use-cases');
    // Down as well as up: from the aggregate, its folder above and its rules below; no sibling and no link.
    const aggregate = neighborhood(index, 'P-D-A1', 1);
    expect(focusIds(aggregate)).toEqual(['P-D-A1', 'P-D-DR01', 'P-D-DR02', 'P-D/define/domain-model']);
    expect(contextIds(aggregate)).toEqual(['P-D/define']);
    for (const n of [one, two, three, aggregate]) expect(n.edges.every((e) => e.relation === 'parent')).toBe(true);
    expect(ids(aggregate)).not.toContain('P-D-Q01');
  });

  it('LA-BRW-T51 The Links switch adds the records the focused record links to and from, one hop, in focus, with their links', () => {
    const n = neighborhood(index, 'P-D-UC01-R01', 1, undefined, undefined, { links: true });
    expect(focusIds(n)).toEqual(['P-D-C01', 'P-D-T01', 'P-D-UC01', 'P-D-UC01-R01', 'P-D-V01']);
    expect(n.edges.filter((e) => e.relation !== 'parent').map((e) => `${e.source} ${e.relation} ${e.target}`).sort()).toEqual([
      'P-D-C01 satisfies P-D-UC01-R01',
      'P-D-T01 proves P-D-UC01-R01',
      'P-D-V01 fulfills P-D-UC01-R01',
    ]);
    // Each one step from the focus, reached from it; they bring no ring of their own.
    for (const id of ['P-D-C01', 'P-D-T01', 'P-D-V01']) {
      expect(n.nodes.find((x) => x.id === id)).toMatchObject({ distance: 1 });
      expect(n.via.get(id)).toBe('P-D-UC01-R01');
    }
    expect(contextIds(n)).toEqual(['P-D/define/use-cases']);
    // Off by default; at any depth the links are the focus's own, not its neighbors'.
    expect(neighborhood(index, 'P-D-UC01-R01', 1).edges.some((e) => e.relation !== 'parent')).toBe(false);
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 3, undefined, undefined, { links: true }))).not.toContain('P-D-E01');
    // A linked record joins the focus.
    const fromUseCase = neighborhood(index, 'P-D-UC01', 1, undefined, undefined, { links: true });
    expect(focusIds(fromUseCase)).toContain('P-D-DR01');
    expect(n).toEqual(neighborhood(index, 'P-D-UC01-R01', 1, undefined, undefined, { links: true }));
  });

  it('LA-BRW-T52 Filters hide kinds and relations, nothing is reached through them, and the focus is never hidden', () => {
    const links = { links: true };
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 1, filters(['test']), undefined, links))).not.toContain('P-D-T01');
    // Hiding satisfies keeps the component out and drops its edge.
    const noSatisfies = neighborhood(index, 'P-D-UC01-R01', 1, filters([], ['satisfies']), undefined, links);
    expect(ids(noSatisfies)).not.toContain('P-D-C01');
    expect(noSatisfies.edges.some((e) => e.relation === 'satisfies')).toBe(false);
    // Hiding use cases cuts the tree there: nothing above the requirement is reached.
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 3, filters(['use_case'])))).toEqual(['P-D-UC01-R01']);
    // Hiding domain rules leaves the aggregate without its rules; a named folder is never hidden by a kind.
    expect(ids(neighborhood(index, 'P-D-A1', 1, filters(['domain_rule', 'aggregate'])))).toEqual(['P-D-A1', 'P-D/define', 'P-D/define/domain-model']);
    // The focus stays even when its own kind is hidden.
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 1, filters(['requirement'])))).toContain('P-D-UC01-R01');
    // Without parent lines there is no tree: the focus and, with Links on, its links.
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 3, filters([], ['parent'])))).toEqual(['P-D-UC01-R01']);
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 3, filters([], ['parent', 'fulfills']), undefined, links))).toEqual(['P-D-C01', 'P-D-T01', 'P-D-UC01-R01']);
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
    // The parent use case and other neighbors are not part of the chain.
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

  it('LA-BRW-T55 The layout gives the same picture every time, with the focus at the center and no overlaps', async () => {
    const n = neighborhood(index, 'P-D-UC01-R01', 3, undefined, undefined, { links: true });
    const { positions, heights } = layoutNeighborhood(n);
    const focusHeight = heights.get('P-D-UC01-R01')!;
    expect(positions.get('P-D-UC01-R01')).toEqual({ x: -NODE_WIDTH / 2, y: -focusHeight / 2 });
    expect(positions.size).toBe(n.nodes.length);
    const boxes = [...positions].map(([id, p]) => ({ ...p, h: heights.get(id)! }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const [a, b] = [boxes[i], boxes[j]];
      const overlap = Math.abs(a.x - b.x) < NODE_WIDTH && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(overlap).toBe(false);
    }
    expect((layoutNeighborhood(neighborhood(index, 'P-D-UC01-R01', 3, undefined, undefined, { links: true }))).positions).toEqual(positions);
    // Re-centering keeps the order within a column: the components of Technical specification, from the stage and from the folder.
    const yOrder = (ps: Map<string, { y: number }>, list: string[]) => [...list].sort((a, b) => ps.get(a)!.y - ps.get(b)!.y);
    const fromStage = (layoutNeighborhood(neighborhood(index, 'P-D/design', 2))).positions;
    const fromFolder = (layoutNeighborhood(neighborhood(index, 'P-D/design/technical-specification', 1))).positions;
    expect(yOrder(fromStage, ['P-D-C02', 'P-D-C01'])).toEqual(['P-D-C01', 'P-D-C02']);
    expect(yOrder(fromFolder, ['P-D-C02', 'P-D-C01'])).toEqual(['P-D-C01', 'P-D-C02']);
    // A single record sits at the center on its own.
    expect((layoutNeighborhood(traceChain(index, 'P-D-DR02'))).positions.get('P-D-DR02')).toEqual({ x: -NODE_WIDTH / 2, y: -NODE_HEIGHT / 2 });
  });

  it('LA-BRW-T56 The breadcrumb trail adds each record visited and cuts back when a visited record is revisited', () => {
    expect(nextTrail([], 'A')).toEqual(['A']);
    expect(nextTrail(['A'], 'B')).toEqual(['A', 'B']);
    expect(nextTrail(['A', 'B', 'C'], 'B')).toEqual(['A', 'B']);
    expect(nextTrail(['A', 'B'], 'B')).toEqual(['A', 'B']);
    expect(nextTrail(['1', '2', '3'], '4', 3)).toEqual(['2', '3', '4']);
  });

  it('LA-BRW-T63 Columns follow the parent/child tree around the focus, and trace mode has its own columns', () => {
    const n = neighborhood(index, 'P-D-UC01-R01', 3);
    const column = new Map(n.nodes.map((x) => [x.id, x.column]));
    // Ancestors one column each to the left, the context ring included; the leftmost column is 0.
    expect(['P-D', 'P-D/define', 'P-D/define/use-cases', 'P-D-UC01', 'P-D-UC01-R01'].map((id) => column.get(id))).toEqual([0, 1, 2, 3, 4]);
    // Every node's parent line runs from one column to the next.
    for (const e of n.edges.filter((e) => e.relation === 'parent')) expect(column.get(e.target)).toBe(column.get(e.source)! + 1);
    // From the domain at depth 2: stages in one column, every folder in the next, whatever it holds.
    const domain = neighborhood(index, 'P-D', 2);
    const dc = new Map(domain.nodes.map((x) => [x.id, x.column]));
    expect(dc.get('P-D/define')).toBe(dc.get('P-D/design'));
    const folders = ['P-D/define/domain-model', 'P-D/define/use-cases', 'P-D/design/interaction-design', 'P-D/design/technical-specification', 'P-D/design/test-plan'];
    expect(new Set(folders.map((id) => dc.get(id)))).toEqual(new Set([dc.get('P-D/define')! + 1]));
    // Trace columns, left to right; a kind a product adds goes with the components.
    expect(['requirement', 'view', 'component', 'test', 'file'].map(traceColumn)).toEqual([0, 1, 2, 3, 4]);
    expect(traceColumn('domain_rule')).toBe(0);
    expect(traceColumn('flow')).toBe(traceColumn('endpoint'));
    expect(traceColumn('scenario')).toBe(TRACE_COLUMNS.component);
    const t = traceChain(index, 'P-D-UC01-R01');
    for (const node of t.nodes) expect(node.column).toBe(traceColumn(node.kind));
  });

  it('LA-BRW-T64 The graph reads left to right by column, and so does a trace', async () => {
    const n = neighborhood(index, 'P-D-UC01-R01', 3, undefined, undefined, { links: true });
    const { positions } = layoutNeighborhood(n);
    const col = (id: string) => positions.get(id)!.x;
    // One x per column, columns in order.
    const columns = new Map<number, Set<number>>();
    for (const node of n.nodes) columns.set(node.column, (columns.get(node.column) ?? new Set()).add(col(node.id)));
    for (const xs of columns.values()) expect(xs.size).toBe(1);
    const order = [...columns.keys()].sort((a, b) => a - b);
    for (let i = 1; i < order.length; i++) expect([...columns.get(order[i])!][0]).toBeGreaterThan([...columns.get(order[i - 1])!][0]);
    // Ancestors to the left of the focus.
    expect(col('P-D/define')).toBeLessThan(col('P-D/define/use-cases'));
    expect(col('P-D/define/use-cases')).toBeLessThan(col('P-D-UC01'));
    expect(col('P-D-UC01')).toBeLessThan(col('P-D-UC01-R01'));
    // What satisfies, fulfills and proves the requirement (Links on) sits one column to its right.
    for (const id of ['P-D-C01', 'P-D-T01', 'P-D-V01']) expect(col(id)).toBeGreaterThan(col('P-D-UC01-R01'));

    const traced = (layoutNeighborhood(traceChain(index, 'P-D-UC01-R01'))).positions;
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
    // The aggregates' folder opened, and Links on: the two aggregates are siblings, so they share a column, and both links are drawn.
    const n = neighborhood(indexWorkspace(w), 'P-D-A1', 1, undefined, new Map([['P-D/define/domain-model', true]]), { links: true });
    const column = new Map(n.nodes.map((x) => [x.id, x.column]));
    expect(column.get('P-D-A2')).toBe(column.get('P-D-A1'));
    expect(n.edges.filter((e) => e.relation === 'relates_to')).toHaveLength(2);
    // Neither link shapes the layout, which stays in columns.
    const placed = layoutNeighborhood(n);
    expect(placed.positions.get('P-D-A2')!.x).toBe(placed.positions.get('P-D-A1')!.x);
  });
});
