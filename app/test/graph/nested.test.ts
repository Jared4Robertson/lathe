import { describe, expect, it } from 'vitest';
import { graphMap } from '../../src/graph/map';
import { LABEL_ASPECT, LABEL_PAD, labelBox, labelHeight, levelTextScale, linesIn, metaWidth, NESTED_LEVEL_STEP, titleWidth, WIDTH_MARGIN, wordsFit } from '../../src/graph/text';
import { LEAF_AREA, layoutNested, NEST_PAD, NESTED_ASPECT, nestedMap, shareRoom, squarify, type NestedMap } from '../../src/graph/nested';
import { indexWorkspace } from '../../src/specs/data';
import { groupedWorkspace, manyOfOneKindWorkspace, testIndex } from './workspace';

// The Nested map (LA-EXP-DR62): the Tree map's tree as a treemap, each box holding its children
// below its header band, sized by the leaf records under it, laid out once.

const maps = (): NestedMap[] => [nestedMap(testIndex(), 'P'), nestedMap(indexWorkspace(groupedWorkspace()), 'P'), nestedMap(indexWorkspace(manyOfOneKindWorkspace()), 'P')];

/** A synthetic tree: `n` roots, each with `k` children, each with `k` leaves. */
function wide(n: number, k: number): NestedMap {
  const kids = (id: string): string[] => (id.split('.').length >= 3 ? [] : Array.from({ length: k }, (_, i) => `${id}.${i}`));
  return layoutNested(Array.from({ length: n }, (_, i) => `r${i}`), kids);
}

const leafCount = (map: NestedMap, id: string): number => {
  const n = map.nodes.get(id)!;
  return n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + leafCount(map, c), 0);
};
const eps = 1e-6;

describe('the Nested map', () => {
  it('LA-EXP-T185 Each box holds its children below its header band, inside its padding, none overlapping, over the same tree as the Tree map', () => {
    for (const map of [...maps(), wide(1, 6), wide(3, 4)]) {
      for (const n of map.nodes.values()) {
        expect(n.w).toBeGreaterThanOrEqual(0);
        expect(n.h).toBeGreaterThanOrEqual(0);
        if (n.children.length === 0) { expect(n.header).toBe(0); continue; }
        const kids = n.children.map((c) => map.nodes.get(c)!);
        for (const k of kids) {
          expect(k.level).toBe(n.level + 1);
          expect(k.parent).toBe(n.id);
          // Inside the box, below the header band.
          expect(k.x).toBeGreaterThanOrEqual(n.x - eps);
          expect(k.y).toBeGreaterThanOrEqual(n.y + n.header - eps);
          expect(k.x + k.w).toBeLessThanOrEqual(n.x + n.w + eps);
          expect(k.y + k.h).toBeLessThanOrEqual(n.y + n.h + eps);
          // Before its children in the keyboard's order.
          expect(k.order).toBeGreaterThan(n.order);
        }
        // Siblings never overlap.
        for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
          const a = kids[i];
          const b = kids[j];
          const apart = a.x + a.w <= b.x + eps || b.x + b.w <= a.x + eps || a.y + a.h <= b.y + eps || b.y + b.h <= a.y + eps;
          expect(apart, `${a.id} and ${b.id}`).toBe(true);
        }
      }
    }
    // The tree is the Tree map's, children in the same order.
    const index = testIndex();
    const tree = graphMap(index, 'P');
    const nested = nestedMap(index, 'P');
    expect(nested.roots).toEqual(tree.roots);
    for (const n of tree.nodes.values()) expect(nested.nodes.get(n.id)!.children).toEqual(n.children);
  });

  it('LA-EXP-T185 A box is sized by the leaf records under it, the world by them all', () => {
    const map = wide(1, 5);
    const root = map.nodes.get('r0')!;
    expect(root.w / root.h).toBeCloseTo(NESTED_ASPECT, 6);
    expect(root.w * root.h).toBeCloseTo(25 * LEAF_AREA, 3);
    // Siblings of equal weight take equal cells: their boxes' areas differ only by the gap around them (a few percent).
    const areas = root.children.map((c) => { const n = map.nodes.get(c)!; return n.w * n.h; });
    for (const a of areas) expect(Math.abs(a / areas[0] - 1)).toBeLessThan(0.03);
    // An unbalanced tree: a child with three times the leaves has about three times the area (the gaps aside).
    const lop = layoutNested(['r'], (id) => (id === 'r' ? ['a', 'b'] : id === 'a' ? ['a1', 'a2', 'a3'] : id === 'b' ? ['b1'] : []));
    const a = lop.nodes.get('a')!;
    const b = lop.nodes.get('b')!;
    expect((a.w * a.h) / (b.w * b.h)).toBeGreaterThan(2.4);
    expect((a.w * a.h) / (b.w * b.h)).toBeLessThan(3.6);
    expect(leafCount(lop, 'r')).toBe(4);
  });

  it('LA-EXP-T186 Squarified in order: equal weights read row by row, the boxes near square, the area shared exactly', () => {
    const r = { x: 0, y: 0, w: 400, h: 400 };
    const cells = squarify([1, 1, 1, 1], r);
    // Four equal weights in a square: a 2 by 2 grid, in reading order (a column, then the next).
    expect(cells.map((c) => [c.x, c.y, c.w, c.h])).toEqual([[0, 0, 200, 200], [0, 200, 200, 200], [200, 0, 200, 200], [200, 200, 200, 200]]);
    // Weights keep their order and share the area exactly.
    const many = squarify([5, 3, 2, 2, 1, 1], { x: 10, y: 20, w: 600, h: 300 });
    const area = many.reduce((s, c) => s + c.w * c.h, 0);
    expect(area).toBeCloseTo(600 * 300, 3);
    expect(many[0].w * many[0].h).toBeCloseTo((5 / 14) * 600 * 300, 3);
    for (const c of many) {
      expect(c.x).toBeGreaterThanOrEqual(10 - eps);
      expect(c.y).toBeGreaterThanOrEqual(20 - eps);
      expect(Math.max(c.w / c.h, c.h / c.w)).toBeLessThan(4);
    }
    // A weight of 0 gets an empty box; no weights, nothing.
    expect(squarify([0, 1], r)[0]).toMatchObject({ w: 0, h: 0 });
    expect(squarify([], r)).toEqual([]);
  });

  it('LA-EXP-T187 One text scale per level, NESTED_LEVEL_STEP times the level below, and every box sized to hold its label at it', () => {
    // A label's least box wraps toward LABEL_ASPECT, nearer it than one long line, and holds the label at scale 1.
    const label = { title: 'Walk the model as a graph', meta: 'Use case · LA-EXP-UC03' };
    const oneLine = Math.max(titleWidth(label.title), metaWidth(label.meta)) * WIDTH_MARGIN + 2 * LABEL_PAD;
    const twoLines = labelHeight({ title: [label.title], meta: [label.meta], file: false });
    const least = labelBox(label, true);
    expect(Math.abs(Math.log(least.w / least.h / LABEL_ASPECT))).toBeLessThan(Math.abs(Math.log(oneLine / twoLines / LABEL_ASPECT)));
    expect(wordsFit(label, least.w, true)).toBe(true);
    expect(labelHeight(linesIn(label, least.w, true))).toBeLessThanOrEqual(least.h + eps);
    // The deepest level's text is 1, each level up NESTED_LEVEL_STEP times the level below's.
    expect(NESTED_LEVEL_STEP).toBe(1.5);
    expect(levelTextScale(3, 3)).toBe(1);
    expect(levelTextScale(2, 3)).toBe(1.5);
    expect(levelTextScale(0, 3)).toBeCloseTo(1.5 ** 3, 9);
    // Children share a room: each at least its least area, the rest by weight, summing to the room.
    expect(shareRoom(100, [1, 1], [10, 10])).toEqual([50, 50]);
    const shared = shareRoom(100, [9, 1], [10, 40]);
    expect(shared[1]).toBeCloseTo(40, 9);
    expect(shared[0] + shared[1]).toBeCloseTo(100, 9);
    expect(shareRoom(10, [1, 1], [10, 10])).toEqual([5, 5]);
    // A leaf whose label needs more than its share of records gets it: a long title takes a bigger box than a short one beside it, at the same text.
    const long = 'A title long enough to need much more room than one record would be given in this map, '.repeat(4).trim();
    const lop = layoutNested(['r'], (id) => (id === 'r' ? ['a', 'b'] : []), (id) => ({ title: id === 'a' ? long : 'B', meta: 'Use case · LA-EXP-UC99' }));
    const [a, b] = [lop.nodes.get('a')!, lop.nodes.get('b')!];
    expect(a.text).toBe(b.text);
    expect(a.w * a.h).toBeGreaterThan(b.w * b.h);
    for (const map of [...maps(), wide(1, 6), wide(3, 4), lop]) {
      const deepest = map.byLevel.length - 1;
      // Every box at one level has the same text scale, its level's, whatever its size.
      map.byLevel.forEach((boxes, l) => { for (const n of boxes) expect(n.text, n.id).toBe(levelTextScale(l, deepest)); });
      for (const n of map.nodes.values()) {
        // Its label, wrapped for its width at that scale, fits it: every word across, a leaf's lines in its height, a parent's header above its padding.
        for (const line of n.lines.title) expect(titleWidth(line.trimEnd()) * WIDTH_MARGIN * n.text, n.id).toBeLessThanOrEqual(n.w - 2 * LABEL_PAD * n.text + eps);
        const height = n.text * labelHeight(n.lines);
        if (n.children.length === 0) { expect(n.header, n.id).toBe(0); expect(height, n.id).toBeLessThanOrEqual(n.h + eps); continue; }
        expect(n.header, n.id).toBeCloseTo(height, 9);
        expect(n.header + NEST_PAD * n.text, n.id).toBeLessThanOrEqual(n.h + eps);
      }
    }
    // Built once per index: the same map object, whatever the focus.
    const index = testIndex();
    expect(nestedMap(index, 'P')).toBe(nestedMap(index, 'P'));
  });
});
