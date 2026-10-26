import { describe, expect, it } from 'vitest';
import { graphMap } from '../../src/graph/map';
import { LABEL_PAD, labelHeight, metaWidth, titleWidth, WIDTH_MARGIN } from '../../src/graph/text';
import { fitScale, headerRoom, HEADER_SHARE, HEADER_SHARE_MAX, LABEL_ASPECT, labelBox, LEAF_AREA, layoutNested, NESTED_ASPECT, nestedMap, shareRoom, squarify, type NestedMap } from '../../src/graph/nested';
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

  it("LA-EXP-T187 Built from the leaves up: each box at least its label's least size, its text scale its own and in proportion to it, every label fitting", () => {
    const label = { title: 'Walk the model as a graph', meta: 'Use case · LA-EXP-UC03' };
    const oneLine = Math.max(titleWidth(label.title), metaWidth(label.meta)) * WIDTH_MARGIN + 2 * LABEL_PAD;
    const twoLines = labelHeight({ title: [label.title], meta: [label.meta], file: false });
    // A box as wide as its label on one line, two lines tall: about scale 1, never more than fits.
    const leaf = fitScale({ w: oneLine + 1, h: twoLines }, label);
    expect(leaf).toBeGreaterThan(0.95);
    expect(leaf).toBeLessThanOrEqual(1);
    // A square box half as wide: the title wraps on whole words, so it holds larger text than one line would.
    const square = { w: oneLine / 2, h: oneLine / 2 };
    const wrapped = fitScale(square, label);
    expect(wrapped).toBeGreaterThan(square.w / oneLine);
    // No word is ever wider than the box, nor any word of the kind and ID line: a word is never broken.
    expect(titleWidth('model') * wrapped).toBeLessThan(square.w);
    expect(metaWidth('LA-EXP-UC03') * wrapped).toBeLessThan(square.w);
    // A bigger box holds a bigger label: the scale grows with the box.
    expect(fitScale({ w: square.w * 4, h: square.h * 4 }, label)).toBeGreaterThan(3 * wrapped);
    // A label's least box wraps toward LABEL_ASPECT, nearer it than one long line, and holds the label at scale 1.
    const least = labelBox(label, true);
    expect(Math.abs(Math.log(least.w / least.h / LABEL_ASPECT))).toBeLessThan(Math.abs(Math.log(oneLine / twoLines / LABEL_ASPECT)));
    expect(fitScale(least, label)).toBeGreaterThan(0.99);
    // A parent's header takes HEADER_SHARE of its size, at most HEADER_SHARE_MAX of its height.
    expect(headerRoom({ w: 100, h: 100 })).toBeCloseTo(HEADER_SHARE * 100, 9);
    expect(headerRoom({ w: 1e6, h: 100 })).toBeCloseTo(HEADER_SHARE_MAX * 100, 9);
    // Children share a room: each at least its least area, the rest by weight, summing to the room.
    expect(shareRoom(100, [1, 1], [10, 10])).toEqual([50, 50]);
    const shared = shareRoom(100, [9, 1], [10, 40]);
    expect(shared[1]).toBeCloseTo(40, 9);
    expect(shared[0] + shared[1]).toBeCloseTo(100, 9);
    expect(shareRoom(10, [1, 1], [10, 10])).toEqual([5, 5]);
    for (const map of [...maps(), wide(1, 6), wide(3, 4)]) {
      for (const n of map.nodes.values()) {
        // Every box has a label that fits it, at a scale of its own: a leaf's in its height, a parent's in its header room.
        expect(n.text, n.id).toBeGreaterThan(0);
        if (n.children.length === 0) { expect(n.header, n.id).toBe(0); expect(n.text * labelHeight(n.lines)).toBeLessThanOrEqual(n.h + eps); continue; }
        expect(n.header).toBeGreaterThan(0);
        expect(n.header).toBeLessThanOrEqual(headerRoom(n) + eps);
      }
    }
    for (const map of [wide(1, 6), wide(3, 4)]) {
      // Each box's scale is the largest its label fits at.
      for (const n of map.nodes.values()) expect(n.text, n.id).toBe(fitScale(n, { title: n.id, meta: '' }, n.children.length === 0 ? n.h : headerRoom(n), n.children.length === 0));
    }
    // Built once per index: the same map object, whatever the focus.
    const index = testIndex();
    expect(nestedMap(index, 'P')).toBe(nestedMap(index, 'P'));
  });
});
