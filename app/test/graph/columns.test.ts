import { recordIndexOf } from '../read-view';
import { describe, expect, it } from 'vitest';
import { neighborhood, type Neighborhood } from '../../src/graph/model';
import { groupedWorkspace, testIndex } from './workspace';
import { graphMap } from './maps';

// Columns follow the parent/child tree: in the one map a level is a column, so every sibling shares
// one, and the framed picture (the records the graph frames at its depth) counts its columns the same way.

const columnOf = (n: Neighborhood) => new Map(n.nodes.map((x) => [x.id, x.column]));
const rowOf = (n: Neighborhood) => new Map(n.nodes.map((x) => [x.id, x.row]));

describe('graph columns by tree depth', () => {
  const index = testIndex();
  const map = graphMap(index, 'P');
  const x = (id: string) => map.nodes.get(id)!.x;

  it('LA-EXP-DS05-T05 LA-V93-R15-T05 Siblings of mixed kinds share a column, in the model and on the canvas', async () => {
    // From the Domain model stage at depth 2: aggregates, the specification, the read model, the domain service
    // and the term are all one level below a folder.
    const n = neighborhood(index, 'P-D/domain-model', 2);
    const column = columnOf(n);
    const level = ['P-D-A1', 'P-D-A4', 'P-D-SP01', 'P-D-RM01', 'P-D-DS01', 'P-D-TM01'];
    expect(new Set(level.map((id) => column.get(id))).size).toBe(1);
    // Every node with the same parent, record or group, is in one column.
    const parentOf = new Map(n.edges.filter((e) => e.relation === 'parent').map((e) => [e.target, e.source]));
    const byParent = new Map<string, Set<number>>();
    for (const [child, parent] of parentOf) byParent.set(parent, (byParent.get(parent) ?? new Set()).add(column.get(child)!));
    for (const cols of byParent.values()) expect(cols.size).toBe(1);
    // In the map: the records straight in a domain's folders, whatever their stage and kind, at one level; a folder's records at one x.
    const members = ['P-D-A1', 'P-D-EP01', 'P-D-EN02-TB', 'P-D-INV01-T'];
    expect(new Set(members.map((id) => map.nodes.get(id)!.level)).size).toBe(1);
    // A stage with one folder (Use cases) holds its records itself, under their aggregates' and read models' groups at
    // its folders' level in the other stages.
    expect(map.nodes.get('P-D/use-cases/P-D-A3')!.level).toBe(map.nodes.get('P-D/domain-model/aggregate')!.level);
    expect(new Set(['P-D-A1', 'P-D-A2', 'P-D-A3', 'P-D-A4'].map(x)).size).toBe(1);
  });

  it('LA-EXP-DS05-T06 LA-V93-R15-T06 The focus\'s ancestors sit one column each to its left and its descendants to its right', async () => {
    // The framed picture: the parent one column to the left, the descendants to the right.
    const column = columnOf(neighborhood(index, 'P-D-UC01', 3));
    expect(['P-D/use-cases/P-D-A3', 'P-D-UC01', 'P-D-UC01/uc_requirement', 'P-D-UC01-R01'].map((id) => column.get(id))).toEqual([0, 1, 2, 3]);
    // The map: every ancestor one level further left.
    const chain = ['P', 'P-D', 'P-D/use-cases', 'P-D/use-cases/P-D-A3', 'P-D-UC01', 'P-D-UC01/uc_requirement', 'P-D-UC01-R01'];
    for (let i = 1; i < chain.length; i++) expect(x(chain[i - 1])).toBeLessThan(x(chain[i]));
  });

  it('LA-EXP-DS05-T08 LA-V93-R27-T02 A group sits in its own column between its parent and its members', () => {
    const grouped = graphMap(recordIndexOf(groupedWorkspace()), 'P');
    const level = (id: string) => grouped.nodes.get(id)!.level;
    expect(level('P-D/domain-model/aggregate')).toBe(level('P-D/domain-model') + 1);
    expect(level('P-D-A4')).toBe(level('P-D/domain-model/aggregate') + 1);
    expect(level('P-D-A4/entity')).toBe(level('P-D-A4') + 1);
    expect(level('P-D-QRY01')).toBe(level('P-D-A4/entity'));
    // Every member is in the map, one level after its group.
    expect(level('P-D-EN06')).toBe(level('P-D-A4/entity') + 1);
  });

  it('LA-EXP-DS05-T09 Within a column nodes follow their parent\'s place, then the nav\'s order, and keep it when the graph re-centers', async () => {
    const grouped = recordIndexOf(groupedWorkspace());
    const n = neighborhood(grouped, 'P-D/domain-model/aggregate', 2);
    const row = rowOf(n);
    // A2 before A4 (the nav's order); A2's groups before A4's, following their parents.
    expect(row.get('P-D-A2')!).toBeLessThan(row.get('P-D-A4')!);
    expect(row.get('P-D-A2/entity')!).toBeLessThan(row.get('P-D-A4/entity')!);
    // A4's groups follow the schema's kind order: entities, then domain events.
    expect(row.get('P-D-A4/entity')!).toBeLessThan(row.get('P-D-A4/domain_event')!);
    // The domain's stages and folders follow the nav: the five stages in order, each stage's folders in kind order.
    const domain = rowOf(neighborhood(grouped, 'P-D', 2));
    const stages = ['P-D/domain-model', 'P-D/use-cases', 'P-D/interface-design', 'P-D/technical-specification', 'P-D/test-plan'];
    expect(stages.map((id) => domain.get(id))).toEqual([0, 1, 2, 3, 4]);
    expect(domain.get('P-D/domain-model/aggregate')!).toBeLessThan(domain.get('P-D/domain-model/specification')!);
    expect(domain.get('P-D/domain-model/term')!).toBeLessThan(domain.get('P-D/use-cases/P-D-A3')!);
    // Rows within each column are 0, 1, 2 ... and the map holds them top to bottom, whatever is in focus.
    const placed = graphMap(grouped, 'P').nodes;
    for (const c of new Set(n.nodes.map((x) => x.column))) {
      const inColumn = n.nodes.filter((x) => x.column === c).sort((a, b) => a.row - b.row);
      expect(inColumn.map((x) => x.row)).toEqual(inColumn.map((_, i) => i));
      const ys = inColumn.map((x) => placed.get(x.id)!.y);
      expect(ys).toEqual([...ys].sort((a, b) => a - b));
    }
  });
});
