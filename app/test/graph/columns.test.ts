import { describe, expect, it } from 'vitest';
import { neighborhood, traceChain, traceColumn, type Neighborhood } from '../../src/graph/model';
import { layoutNeighborhood } from '../../src/graph/layout';
import { indexWorkspace } from '../../src/specs/data';
import { groupedWorkspace, testIndex } from './workspace';

// Columns follow the parent/child tree around the focus, so every sibling shares a column.

const columnOf = (n: Neighborhood) => new Map(n.nodes.map((x) => [x.id, x.column]));
const rowOf = (n: Neighborhood) => new Map(n.nodes.map((x) => [x.id, x.row]));

describe('graph columns by tree depth', () => {
  const index = testIndex();

  it('LA-EXP-T78 Siblings of mixed kinds share a column, in the model and on the canvas', async () => {
    // From the Design stage at depth 2: the views' and endpoints' groups, the components and the test plan's group are all one level below a folder.
    const n = neighborhood(index, 'P-D/design', 2);
    const column = columnOf(n);
    const level = ['P-D/design/interaction-design/view', 'P-D/design/interaction-design/endpoint', 'P-D-C01', 'P-D-C02', 'P-D/design/test-plan/acceptance/P-D-UC01'];
    expect(new Set(level.map((id) => column.get(id))).size).toBe(1);
    // Every node with the same parent, record or group, is in one column.
    const parentOf = new Map(n.edges.filter((e) => e.relation === 'parent').map((e) => [e.target, e.source]));
    const byParent = new Map<string, Set<number>>();
    for (const [child, parent] of parentOf) byParent.set(parent, (byParent.get(parent) ?? new Set()).add(column.get(child)!));
    for (const cols of byParent.values()) expect(cols.size).toBe(1);
    // A domain at depth 3: the records straight in its folders (aggregates, use cases, components), whatever their kind, in one column.
    const domain = neighborhood(index, 'P-D', 3);
    const dc = columnOf(domain);
    const members = ['P-D-A1', 'P-D-UC01', 'P-D-C01', 'P-D-C02'];
    expect(new Set(members.map((id) => dc.get(id))).size).toBe(1);
    const { positions } = layoutNeighborhood(domain);
    expect(new Set(members.map((id) => positions.get(id)!.x)).size).toBe(1);
  });

  it('LA-EXP-T79 The focus\'s ancestors sit one column each to its left and its descendants to its right', async () => {
    const n = neighborhood(index, 'P-D-UC01', 3);
    const column = columnOf(n);
    expect(['P', 'P-D', 'P-D/define', 'P-D/define/use-cases', 'P-D-UC01', 'P-D-UC01-R01'].map((id) => column.get(id))).toEqual([0, 1, 2, 3, 4, 5]);
    const { positions } = layoutNeighborhood(n);
    const x = (id: string) => positions.get(id)!.x;
    expect(x('P')).toBeLessThan(x('P-D'));
    expect(x('P-D')).toBeLessThan(x('P-D/define'));
    expect(x('P-D/define')).toBeLessThan(x('P-D/define/use-cases'));
    expect(x('P-D/define/use-cases')).toBeLessThan(x('P-D-UC01'));
    expect(x('P-D-UC01')).toBeLessThan(x('P-D-UC01-R01'));
  });

  it('LA-EXP-T80 A cross-linked record sits one column after the record it is reached from, unless its tree position places it', () => {
    // Without parent lines, what the requirement links to is reached from it, one column after it.
    const chain = neighborhood(index, 'P-D-UC01-R01', 1, { hiddenKinds: new Set(), hiddenRelations: new Set(['parent']) }, undefined, { links: true });
    const column = columnOf(chain);
    expect(chain.via.get('P-D-V01')).toBe('P-D-UC01-R01');
    expect(column.get('P-D-V01')).toBe(column.get('P-D-UC01-R01')! + 1);
    // With the tree: the service's view sits one column after it, but the router, which depends on it,
    // is also its sibling in Technical specification: its tree position wins, beside the service.
    const service = neighborhood(index, 'P-D-C01', 1, undefined, undefined, { links: true });
    const sc = columnOf(service);
    expect(sc.get('P-D-V01')).toBe(sc.get('P-D-C01')! + 1);
    expect(sc.get('P-D-C02')).toBe(sc.get('P-D-C01'));
    expect(service.edges.map((e) => e.id)).toContain('P-D/design/technical-specification|parent|P-D-C02');
  });

  it('LA-EXP-T81 A group sits in its own column between its parent and its members', () => {
    const grouped = indexWorkspace(groupedWorkspace());
    const n = neighborhood(grouped, 'P-D/define/use-cases', 3);
    const column = columnOf(n);
    expect(column.get('P-D/define/use-cases')).toBe(column.get('P-D/define')! + 1);
    expect(column.get('P-D-UC02')).toBe(column.get('P-D/define/use-cases')! + 1);
    expect(column.get('P-D-UC02/requirement')).toBe(column.get('P-D-UC02')! + 1);
    expect(column.get('P-D-UC01-R01')).toBe(column.get('P-D-UC02/requirement'));
    // The requirements behind the folded group are not shown; opened, they sit one column after it.
    const opened = columnOf(neighborhood(grouped, 'P-D/define/use-cases', 3, undefined, new Map([['P-D-UC02/requirement', true]])));
    expect(opened.get('P-D-UC02-R01')).toBe(opened.get('P-D-UC02/requirement')! + 1);
  });

  it('LA-EXP-T82 Within a column nodes follow their parent\'s place, then the nav\'s order, and keep it when the graph re-centers', async () => {
    const grouped = indexWorkspace(groupedWorkspace());
    const n = neighborhood(grouped, 'P-D/define/use-cases', 2);
    const row = rowOf(n);
    // UC01 before UC02 (the nav's order); UC01's requirement before UC02's groups, following their parents.
    expect(row.get('P-D-UC01')!).toBeLessThan(row.get('P-D-UC02')!);
    expect(row.get('P-D-UC01-R01')!).toBeLessThan(row.get('P-D-UC02/requirement')!);
    // UC02's groups follow the meta-model's kind order: requirements, then questions.
    expect(row.get('P-D-UC02/requirement')!).toBeLessThan(row.get('P-D-UC02/question')!);
    // The domain's stages and folders follow the nav: Define before Design, each stage's folders in their order.
    const domain = rowOf(neighborhood(grouped, 'P-D', 2));
    expect(domain.get('P-D/define')!).toBeLessThan(domain.get('P-D/design')!);
    const folders = ['P-D/define/domain-model', 'P-D/define/use-cases', 'P-D/design/interaction-design', 'P-D/design/technical-specification', 'P-D/design/test-plan'];
    expect(folders.map((id) => domain.get(id))).toEqual([0, 1, 2, 3, 4]);
    // Rows within each column are 0, 1, 2 ... and the canvas draws them top to bottom.
    const { positions } = layoutNeighborhood(n);
    for (const c of new Set(n.nodes.map((x) => x.column))) {
      const inColumn = n.nodes.filter((x) => x.column === c).sort((a, b) => a.row - b.row);
      expect(inColumn.map((x) => x.row)).toEqual(inColumn.map((_, i) => i));
      const ys = inColumn.map((x) => positions.get(x.id)!.y);
      expect(ys).toEqual([...ys].sort((a, b) => a - b));
    }
    // Re-centering on a member, its folder opened, keeps the siblings' order.
    const fromMember = rowOf(neighborhood(grouped, 'P-D-UC02', 1, undefined, new Map([['P-D/define/use-cases', true]])));
    expect(fromMember.get('P-D-UC01')!).toBeLessThan(fromMember.get('P-D-UC02')!);
  });

  it('LA-EXP-T83 Trace mode keeps its own columns, from the rule to the files', () => {
    const t = traceChain(index, 'P-D-UC01-R01');
    for (const node of t.nodes) expect(node.column).toBe(traceColumn(node.kind));
    expect(columnOf(t).get('P-D-UC01-R01')).toBe(0);
  });
});
