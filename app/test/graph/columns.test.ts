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

  it('LA-BRW-T250 Siblings of mixed kinds share a column, in the model and on the canvas', async () => {
    // From a component, the domain's components and its view are siblings of three kinds' groups.
    const n = neighborhood(index, 'P-D-C01', 1, undefined, new Map([['P-D/view', true]]));
    const column = columnOf(n);
    expect(column.get('P-D/view')).toBe(column.get('P-D/component'));
    for (const id of ['P-D-C02', 'P-D-V01']) expect(column.get(id)).toBe(column.get('P-D-C01'));
    // Every node with the same parent, record or group, is in one column.
    const parentOf = new Map(n.edges.filter((e) => e.relation === 'parent').map((e) => [e.target, e.source]));
    const byParent = new Map<string, Set<number>>();
    for (const [child, parent] of parentOf) byParent.set(parent, (byParent.get(parent) ?? new Set()).add(column.get(child)!));
    for (const cols of byParent.values()) expect(cols.size).toBe(1);
    // A domain with every group open: aggregates, use cases, views, endpoints, components and tests in one column.
    const open = new Map(['aggregate', 'use_case', 'view', 'endpoint', 'component', 'test', 'question'].map((k) => [`P-D/${k}`, true]));
    const domain = neighborhood(index, 'P-D', 1, undefined, open);
    const dc = columnOf(domain);
    const members = ['P-D-A1', 'P-D-UC01', 'P-D-V01', 'P-D-E01', 'P-D-C01', 'P-D-C02', 'P-D-T01', 'P-D-Q01'];
    expect(new Set(members.map((id) => dc.get(id))).size).toBe(1);
    const { positions } = await layoutNeighborhood(domain);
    expect(new Set(members.map((id) => positions.get(id)!.x)).size).toBe(1);
  });

  it('LA-BRW-T251 The focus\'s ancestors sit one column each to its left and its descendants to its right', async () => {
    const n = neighborhood(index, 'P-D-UC01', 2);
    const column = columnOf(n);
    expect(['P', 'P-D', 'P-D/use_case', 'P-D-UC01', 'P-D-UC01-R01'].map((id) => column.get(id))).toEqual([0, 1, 2, 3, 4]);
    const { positions } = await layoutNeighborhood(n);
    const x = (id: string) => positions.get(id)!.x;
    expect(x('P')).toBeLessThan(x('P-D'));
    expect(x('P-D')).toBeLessThan(x('P-D/use_case'));
    expect(x('P-D/use_case')).toBeLessThan(x('P-D-UC01'));
    expect(x('P-D-UC01')).toBeLessThan(x('P-D-UC01-R01'));
  });

  it('LA-BRW-T252 A cross-linked record sits one column after the record it is reached from, unless its tree position places it', () => {
    // Without parent lines, the view is reached from the requirement and the endpoint from the view.
    const chain = neighborhood(index, 'P-D-UC01-R01', 2, { hiddenKinds: new Set(), hiddenRelations: new Set(['parent']) });
    const column = columnOf(chain);
    expect(chain.via.get('P-D-V01')).toBe('P-D-UC01-R01');
    expect(column.get('P-D-V01')).toBe(column.get('P-D-UC01-R01')! + 1);
    expect(chain.via.get('P-D-E01')).toBe('P-D-V01');
    expect(column.get('P-D-E01')).toBe(column.get('P-D-V01')! + 1);
    // At depth 1 the test is reached only by proves: one column after the requirement.
    const near = columnOf(neighborhood(index, 'P-D-UC01-R01', 1));
    expect(near.get('P-D-T01')).toBe(near.get('P-D-UC01-R01')! + 1);
    // At depth 2 the domain is shown, so the test is also its child: its tree position wins, beside the use case.
    const deep = columnOf(neighborhood(index, 'P-D-UC01-R01', 2));
    expect(deep.get('P-D-T01')).toBe(deep.get('P-D-UC01'));
  });

  it('LA-BRW-T253 A group sits in its own column between its parent and its members', () => {
    const grouped = indexWorkspace(groupedWorkspace());
    const n = neighborhood(grouped, 'P-D/use_case', 2);
    const column = columnOf(n);
    expect(column.get('P-D/use_case')).toBe(column.get('P-D')! + 1);
    expect(column.get('P-D-UC02')).toBe(column.get('P-D/use_case')! + 1);
    expect(column.get('P-D-UC02/requirement')).toBe(column.get('P-D-UC02')! + 1);
    expect(column.get('P-D-UC01-R01')).toBe(column.get('P-D-UC02/requirement'));
    // The requirements behind the folded group are not shown; opened, they sit one column after it.
    const opened = columnOf(neighborhood(grouped, 'P-D/use_case', 2, undefined, new Map([['P-D-UC02/requirement', true]])));
    expect(opened.get('P-D-UC02-R01')).toBe(opened.get('P-D-UC02/requirement')! + 1);
  });

  it('LA-BRW-T254 Within a column nodes follow their parent\'s place, then kind order, then ID, and keep it when the graph re-centers', async () => {
    const grouped = indexWorkspace(groupedWorkspace());
    const n = neighborhood(grouped, 'P-D/use_case', 2);
    const row = rowOf(n);
    // UC01 before UC02 (by ID); UC01's requirement before UC02's group, following their parents.
    expect(row.get('P-D-UC01')!).toBeLessThan(row.get('P-D-UC02')!);
    expect(row.get('P-D-UC01-R01')!).toBeLessThan(row.get('P-D-UC02/requirement')!);
    // The domain's groups follow the meta-model's kind order.
    const kinds = grouped.workspace.kinds.map((k) => k.kind);
    const groups = n.nodes.filter((x) => x.group && x.group.parent === 'P-D').sort((a, b) => a.row - b.row).map((x) => kinds.indexOf(x.kind));
    expect(groups).toEqual([...groups].sort((a, b) => a - b));
    // Rows within each column are 0, 1, 2 ... and the canvas draws them top to bottom.
    const { positions } = await layoutNeighborhood(n);
    for (const c of new Set(n.nodes.map((x) => x.column))) {
      const inColumn = n.nodes.filter((x) => x.column === c).sort((a, b) => a.row - b.row);
      expect(inColumn.map((x) => x.row)).toEqual(inColumn.map((_, i) => i));
      const ys = inColumn.map((x) => positions.get(x.id)!.y);
      expect(ys).toEqual([...ys].sort((a, b) => a - b));
    }
    // Re-centring on a member keeps the siblings' order.
    const fromMember = rowOf(neighborhood(grouped, 'P-D-UC02', 2));
    expect(fromMember.get('P-D-UC01')!).toBeLessThan(fromMember.get('P-D-UC02')!);
  });

  it('LA-BRW-T255 Trace mode keeps its own columns, from the rule to the files', () => {
    const t = traceChain(index, 'P-D-UC01-R01');
    for (const node of t.nodes) expect(node.column).toBe(traceColumn(node.kind));
    expect(columnOf(t).get('P-D-UC01-R01')).toBe(0);
  });
});
