import { describe, expect, it } from 'vitest';
import { addRows, indexOf } from '../fixtures/load';
import { neighborhood, type Filters } from '../../src/graph/model';
import { graphMap } from '../../src/graph/map';
import { testIndex, testWorkspace } from './workspace';

const ids = (n: { nodes: { id: string }[] }) => n.nodes.map((x) => x.id).sort();
const filters = (kinds: string[] = []): Filters => ({ hiddenKinds: new Set(kinds) });

describe('graph neighborhood', () => {
  const index = testIndex();

  it('LA-EXP-DS09-T01 LA-V93-R10-T01 Depth counts levels of the tree below the focus, stages and folders included, with the parent kept; siblings and links are not added', () => {
    // Depth 1: the requirement and its use case, the parent at the left edge. Its test is in the test plan, not below it.
    const one = neighborhood(index, 'P-D-UC01-R01', 1);
    expect(one.nodes[0]).toMatchObject({ id: 'P-D-UC01-R01', distance: 0 });
    expect(ids(one)).toEqual(['P-D-UC01', 'P-D-UC01-R01']);
    // A leaf has nothing below it, so depth 2 and 3 frame the same picture.
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 3))).toEqual(['P-D-UC01', 'P-D-UC01-R01']);
    // From the Use cases stage, which holds only capabilities and so lists them itself, each depth one level further
    // down: the capability, its use case, its requirements.
    const stage = (d: number) => ids(neighborhood(index, 'P-D/use-cases', d));
    expect(stage(1)).toEqual(['P-D', 'P-D-CAP01', 'P-D/use-cases']);
    expect(stage(2)).toEqual(['P-D', 'P-D-CAP01', 'P-D-UC01', 'P-D/use-cases']);
    expect(stage(3)).toEqual(expect.arrayContaining(['P-D-UC01', 'P-D-UC01-R01', 'P-D-UC01-R02']));
    // From the Domain model stage, which keeps its folders: its folders, then their records.
    expect(ids(neighborhood(index, 'P-D/domain-model', 1))).toEqual(expect.arrayContaining(['P-D', 'P-D/domain-model', 'P-D/domain-model/aggregate']));
    expect(ids(neighborhood(index, 'P-D/domain-model', 1))).not.toContain('P-D-A1');
    // Each node at its level, reached from the one above it.
    const four = neighborhood(index, 'P-D/use-cases', 4);
    const distance = new Map(four.nodes.map((x) => [x.id, x.distance]));
    expect(['P-D-CAP01', 'P-D-UC01', 'P-D-UC01-R01'].map((id) => distance.get(id))).toEqual([1, 2, 3]);
    // Down as well as up: from an aggregate, its folder above and its entity below; no sibling and no link.
    const aggregate = neighborhood(index, 'P-D-A4', 1);
    expect(ids(aggregate)).toEqual(['P-D-A4', 'P-D-EN06', 'P-D/domain-model/aggregate']);
    for (const n of [one, four, aggregate]) expect(n.edges.every((e) => e.relation === 'parent')).toBe(true);
    expect(ids(aggregate)).not.toContain('P-D-A1');
  });

  it('LA-EXP-SP04-T LA-V93-R13-T01 Filters hide kinds, nothing is reached through them, and the focus is never hidden', () => {
    // Hiding use cases cuts the tree there: nothing above the requirement is reached.
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 3, filters(['use_case'])))).toEqual(['P-D-UC01-R01']);
    // Hiding entities leaves the aggregate without them; a folder goes with its kind, a stage has none and stays.
    expect(ids(neighborhood(index, 'P-D-A4', 1, filters(['entity'])))).toEqual(['P-D-A4', 'P-D/domain-model/aggregate']);
    expect(ids(neighborhood(index, 'P-D/domain-model', 2, filters(['aggregate'])))).not.toContain('P-D-A1');
    expect(ids(neighborhood(index, 'P-D', 1, filters(['aggregate'])))).toContain('P-D/domain-model');
    // The focus stays even when its own kind is hidden.
    expect(ids(neighborhood(index, 'P-D-UC01-R01', 1, filters(['uc_requirement'])))).toContain('P-D-UC01-R01');
  });

  it('LA-EXP-DS05-T01 The layout gives the same map every time, whatever the focus, with no overlaps', async () => {
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
    // The order within a level is the nav's: the tables in ID order.
    expect(map.nodes.get('P-D-EN02-TB')!.y).toBeLessThan(map.nodes.get('P-D-EN03-TB')!.y);
  });

  it('LA-V93-R15-T01 Columns follow the parent/child tree around the focus', () => {
    const n = neighborhood(index, 'P-D/use-cases', 4);
    const column = new Map(n.nodes.map((x) => [x.id, x.column]));
    // The parent one column to the left, each level below one more to the right; the leftmost column is 0.
    expect(['P-D', 'P-D/use-cases', 'P-D-CAP01', 'P-D-UC01', 'P-D-UC01-R01'].map((id) => column.get(id))).toEqual([0, 1, 2, 3, 4]);
    // Every node's parent line runs from one column to the next.
    for (const e of n.edges.filter((e) => e.relation === 'parent')) expect(column.get(e.target)).toBe(column.get(e.source)! + 1);
    // From the domain at depth 2: stages in one column, every folder (or a one-folder stage's record) in the next,
    // whatever it holds.
    const domain = neighborhood(index, 'P-D', 2);
    const dc = new Map(domain.nodes.map((x) => [x.id, x.column]));
    expect(dc.get('P-D/domain-model')).toBe(dc.get('P-D/test-plan'));
    const folders = ['P-D/domain-model/aggregate', 'P-D-CAP01', 'P-D/interaction-design/flow', 'P-D/technical-specification/table', 'P-D/test-plan/use_case_test'];
    expect(new Set(folders.map((id) => dc.get(id)))).toEqual(new Set([dc.get('P-D/domain-model')! + 1]));
  });

  it('LA-EXP-DS06-T01 LA-V93-R15-T02 The graph reads left to right by column', async () => {
    const map = graphMap(index, 'P');
    // Siblings share one x and one width, each column right of its parent's.
    for (const parent of map.nodes.values()) {
      const level = parent.children.map((c) => map.nodes.get(c)!);
      if (level.length === 0) continue;
      expect(new Set(level.map((n) => n.x)).size).toBe(1);
      expect(new Set(level.map((n) => n.w)).size).toBe(1);
      expect(level[0].x).toBeGreaterThan(parent.x + parent.w);
    }
    // Ancestors to the left of a record.
    const col = (id: string) => map.nodes.get(id)!.x;
    const chain = ['P-D/domain-model', 'P-D/domain-model/aggregate', 'P-D-A4', 'P-D-EN06'];
    for (let i = 1; i < chain.length; i++) expect(col(chain[i - 1])).toBeLessThan(col(chain[i]));
  });

  it('LA-V93-R15-T03 Links never change the map or the framed picture: every box where it was without them', async () => {
    const w = testWorkspace();
    addRows(w, 'entity', { id: 'P-D-EN07', title: 'Tag', aggregate_id: 'P-D-A3', role: 'child' });
    const before = indexOf(w);
    addRows(w, 'has_many', { source_id: 'P-D-EN03', target_id: 'P-D-EN07' });
    addRows(w, 'has_one', { source_id: 'P-D-EN07', target_id: 'P-D-EN03' });
    const linked = indexOf(w);
    // Neither link shapes the map: every box is where it was without them.
    const at = (ix: typeof linked) => [...graphMap(ix, 'P').nodes.values()].map((x) => [x.id, x.x, x.y]);
    expect(at(linked)).toEqual(at(before));
    // Nor the picture framed around one end: only the tree, with no link drawn.
    const picture = (ix: typeof linked) => neighborhood(ix, 'P-D-EN07', 1);
    expect(picture(linked)).toEqual(picture(before));
    expect(picture(linked).edges.every((e) => e.relation === 'parent')).toBe(true);
  });
});
