import { describe, expect, it } from 'vitest';
import { addRows, indexOf } from '../fixtures/load';
import { canTrace, fileNodeId, neighborhood, nextTrail, TRACE_COLUMNS, traceChain, traceColumn, type Filters } from '../../src/graph/model';
import { NODE_HEIGHT, NODE_WIDTH, traceGrid } from '../../src/graph/layout';
import { graphMap } from '../../src/graph/map';
import { testIndex, testWorkspace } from './workspace';

const ids = (n: { nodes: { id: string }[] }) => n.nodes.map((x) => x.id).sort();
const filters = (kinds: string[] = [], relations: string[] = []): Filters => ({ hiddenKinds: new Set(kinds), hiddenRelations: new Set(relations) });

describe('graph neighborhood', () => {
  const index = testIndex();

  it('LA-EXP-T13 Depth counts levels of the tree below the focus, stages and folders included, with the parent kept; siblings and links are not added', () => {
    // Depth 1: the requirement and its use case, the parent at the left edge.
    const one = neighborhood(index, 'P-D-UC01-R01', 1);
    expect(one.nodes[0]).toMatchObject({ id: 'P-D-UC01-R01', distance: 0 });
    expect(ids(one)).toEqual(['P-D-UC01', 'P-D-UC01-R01']);
    // A leaf has nothing below it, so depth 2 and 3 frame the same picture.
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 3))).toEqual(['P-D-UC01', 'P-D-UC01-R01']);
    // From the Define stage, each depth one level further down: folders, their records, their children.
    const stage = (d: number) => ids(neighborhood(index, 'P-D/define', d));
    expect(stage(1)).toEqual(['P-D', 'P-D/define', 'P-D/define/domain-model', 'P-D/define/use-cases']);
    expect(stage(2)).toEqual(['P-D', 'P-D-A1', 'P-D-UC01', 'P-D/define', 'P-D/define/domain-model', 'P-D/define/use-cases']);
    expect(stage(3)).toEqual(expect.arrayContaining(['P-D-DR01', 'P-D-DR02', 'P-D-UC01-R01']));
    // Each node at its level, reached from the one above it.
    const three = neighborhood(index, 'P-D/define', 3);
    const distance = new Map(three.nodes.map((x) => [x.id, x.distance]));
    expect(['P-D/define/use-cases', 'P-D-UC01', 'P-D-UC01-R01'].map((id) => distance.get(id))).toEqual([1, 2, 3]);
    expect(three.via.get('P-D-UC01-R01')).toBe('P-D-UC01');
    // Down as well as up: from the aggregate, its folder above and its rules below; no sibling and no link.
    const aggregate = neighborhood(index, 'P-D-A1', 1);
    expect(ids(aggregate)).toEqual(['P-D-A1', 'P-D-DR01', 'P-D-DR02', 'P-D/define/domain-model']);
    for (const n of [one, three, aggregate]) expect(n.edges.every((e) => e.relation === 'parent')).toBe(true);
    expect(ids(aggregate)).not.toContain('P-D-Q01');
  });

  it('LA-EXP-T14 The Links switch adds the records the focused record links to and from, one hop, in focus, with their links', () => {
    const n = neighborhood(index, 'P-D-UC01-R01', 1, undefined, { links: true });
    expect(ids(n)).toEqual(['P-D-C01', 'P-D-T01', 'P-D-UC01', 'P-D-UC01-R01', 'P-D-V01']);
    expect(n.edges.filter((e) => e.relation !== 'parent').map((e) => `${e.source} ${e.relation} ${e.target}`).sort()).toEqual([
      'P-D-C01 satisfies P-D-UC01-R01',
      'P-D-T01 proves P-D-UC01-R01',
      'P-D-V01 fulfills P-D-UC01-R01',
    ]);
    // Each one step from the focus, reached from it; they bring nothing of their own.
    for (const id of ['P-D-C01', 'P-D-T01', 'P-D-V01']) {
      expect(n.nodes.find((x) => x.id === id)).toMatchObject({ distance: 1 });
      expect(n.via.get(id)).toBe('P-D-UC01-R01');
    }
    // Off by default; at any depth the links are the focus's own, not its neighbors'.
    expect(neighborhood(index, 'P-D-UC01-R01', 1).edges.some((e) => e.relation !== 'parent')).toBe(false);
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 3, undefined, { links: true }))).not.toContain('P-D-E01');
    // A linked record joins the focus.
    const fromUseCase = neighborhood(index, 'P-D-UC01', 1, undefined, { links: true });
    expect(ids(fromUseCase)).toContain('P-D-DR01');
    expect(n).toEqual(neighborhood(index, 'P-D-UC01-R01', 1, undefined, { links: true }));
  });

  it('LA-EXP-T15 Filters hide kinds and relations, nothing is reached through them, and the focus is never hidden', () => {
    const links = { links: true };
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 1, filters(['test']), links))).not.toContain('P-D-T01');
    // Hiding satisfies keeps the component out and drops its edge.
    const noSatisfies = neighborhood(index, 'P-D-UC01-R01', 1, filters([], ['satisfies']), links);
    expect(ids(noSatisfies)).not.toContain('P-D-C01');
    expect(noSatisfies.edges.some((e) => e.relation === 'satisfies')).toBe(false);
    // Hiding use cases cuts the tree there: nothing above the requirement is reached.
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 3, filters(['use_case'])))).toEqual(['P-D-UC01-R01']);
    // Hiding domain rules leaves the aggregate without its rules; a named folder is never hidden by a kind.
    expect(ids(neighborhood(index, 'P-D-A1', 1, filters(['domain_rule', 'aggregate'])))).toEqual(['P-D-A1', 'P-D/define/domain-model']);
    expect(ids(neighborhood(index, 'P-D/define', 2, filters(['aggregate'])))).not.toContain('P-D-A1');
    // The focus stays even when its own kind is hidden.
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 1, filters(['requirement'])))).toContain('P-D-UC01-R01');
    // Without parent lines there is no tree: the focus and, with Links on, its links.
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 3, filters([], ['parent'])))).toEqual(['P-D-UC01-R01']);
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 3, filters([], ['parent', 'fulfills']), links))).toEqual(['P-D-C01', 'P-D-T01', 'P-D-UC01-R01']);
  });

  it('LA-TRC-T86 Trace mode shows what fulfills, satisfies and proves a requirement, and the files they name', () => {
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

  it('LA-TRC-T87 Trace mode is offered only for requirements and domain rules', () => {
    expect(canTrace(index, 'P-D-UC01-R01')).toBe(true);
    expect(canTrace(index, 'P-D-DR01')).toBe(true);
    for (const id of ['P', 'P-D', 'P-D-UC01', 'P-D-C01', 'P-D-T01', 'P-D-V01', 'missing']) expect(canTrace(index, id)).toBe(false);
    expect(traceChain(index, 'P-D-UC01').nodes).toEqual([]);
  });

  it('LA-EXP-T16 The layout gives the same map every time, whatever the focus, with no overlaps', async () => {
    const map = graphMap(index, 'P');
    // Built once per index, and the same for an index built again from the same workspace.
    expect(graphMap(index, 'P')).toBe(map);
    const again = graphMap(testIndex(), 'P');
    expect([...again.nodes.values()].map((n) => [n.id, n.x, n.y, n.w, n.h])).toEqual([...map.nodes.values()].map((n) => [n.id, n.x, n.y, n.w, n.h]));
    // No two boxes overlap.
    const boxes = [...map.nodes.values()];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const [a, b] = [boxes[i], boxes[j]];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(overlap, `${a.id} and ${b.id}`).toBe(false);
    }
    // The order within a level is the nav's: Technical specification's components, C01 above C02.
    expect(map.nodes.get('P-D-C01')!.y).toBeLessThan(map.nodes.get('P-D-C02')!.y);
    // A trace is a picture of its own, its focus at the center.
    expect(traceGrid(traceChain(index, 'P-D-DR02')).positions.get('P-D-DR02')).toEqual({ x: -NODE_WIDTH / 2, y: -NODE_HEIGHT / 2 });
  });

  it('LA-EXP-T17 The breadcrumb trail adds each record visited and cuts back when a visited record is revisited', () => {
    expect(nextTrail([], 'A')).toEqual(['A']);
    expect(nextTrail(['A'], 'B')).toEqual(['A', 'B']);
    expect(nextTrail(['A', 'B', 'C'], 'B')).toEqual(['A', 'B']);
    expect(nextTrail(['A', 'B'], 'B')).toEqual(['A', 'B']);
    expect(nextTrail(['1', '2', '3'], '4', 3)).toEqual(['2', '3', '4']);
  });

  it('LA-EXP-T23 Columns follow the parent/child tree around the focus, and trace mode has its own columns', () => {
    const n = neighborhood(index, 'P-D/define', 3);
    const column = new Map(n.nodes.map((x) => [x.id, x.column]));
    // The parent one column to the left, each level below one more to the right; the leftmost column is 0.
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

  it('LA-EXP-T24 The graph reads left to right by column, and so does a trace', async () => {
    const map = graphMap(index, 'P');
    // One x and one width per level, levels in order.
    for (const level of map.byLevel) {
      expect(new Set(level.map((n) => n.x)).size).toBe(1);
      expect(new Set(level.map((n) => n.w)).size).toBe(1);
    }
    for (let l = 1; l < map.levels.length; l++) expect(map.levels[l].x).toBeGreaterThan(map.levels[l - 1].x + map.levels[l - 1].width);
    // Ancestors to the left of a record; what links to it (Links on) keeps its own place in the map.
    const col = (id: string) => map.nodes.get(id)!.x;
    expect(col('P-D/define')).toBeLessThan(col('P-D/define/use-cases'));
    expect(col('P-D/define/use-cases')).toBeLessThan(col('P-D-UC01'));
    expect(col('P-D-UC01')).toBeLessThan(col('P-D-UC01-R01'));

    const traced = traceGrid(traceChain(index, 'P-D-UC01-R01')).positions;
    const x = (id: string) => traced.get(id)!.x;
    expect(x('P-D-UC01-R01')).toBeLessThan(x('P-D-V01'));
    expect(x('P-D-V01')).toBeLessThan(x('P-D-C01'));
    expect(x('P-D-C01')).toBeLessThan(x('P-D-T01'));
    expect(x('P-D-T01')).toBeLessThan(x('file:test/thing.test.ts'));
    expect(x('file:src/thing.ts')).toBe(x('file:test/thing.test.ts'));
  });

  it('LA-EXP-T25 Links between records in one column are drawn but never change the map', async () => {
    const w = testWorkspace();
    addRows(w, 'aggregate', { id: 'P-D-A2', title: 'Owner', domain_id: 'P-D' });
    const before = graphMap(indexOf(w), 'P');
    addRows(w, 'relates_to', { source_id: 'P-D-A1', target_id: 'P-D-A2' }, { source_id: 'P-D-A2', target_id: 'P-D-A1' });
    const linked = indexOf(w);
    // Links on: the two aggregates are siblings, so they share a column, and both links are drawn.
    const n = neighborhood(linked, 'P-D-A1', 1, undefined, { links: true });
    const column = new Map(n.nodes.map((x) => [x.id, x.column]));
    expect(column.get('P-D-A2')).toBe(column.get('P-D-A1'));
    expect(n.edges.filter((e) => e.relation === 'relates_to')).toHaveLength(2);
    // Neither link shapes the map: every box is where it was without them.
    const after = graphMap(linked, 'P');
    expect([...after.nodes.values()].map((x) => [x.id, x.x, x.y])).toEqual([...before.nodes.values()].map((x) => [x.id, x.x, x.y]));
  });
});
