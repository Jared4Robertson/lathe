import { describe, expect, it } from 'vitest';
import { graphMap } from '../../src/graph/map';
import { LABEL_PAD, labelHeight, metaWidth, titleWidth, WIDTH_MARGIN } from '../../src/graph/text';
import { fitScale, headerRoom, HEADER_SHARE_MAX, HEADER_SHARE_MIN, headerShare, LEAF_AREA, layoutNested, LEVEL_FIT_SHARE, levelScale, NESTED_ASPECT, nestedMap, squarify, type NestedMap } from '../../src/graph/nested';
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

  it("LA-EXP-T187 One text scale per nesting level, fixed by the map: labels wrap on whole words, and a box whose label does not fit is plain", () => {
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
    // A parent's label fits its header band's room: its share of the box's size, 0.4 over one leaf, falling with the root of the leaves to a fifth, and at most 0.4 of its height.
    expect(headerShare(1)).toBe(HEADER_SHARE_MAX);
    expect(headerShare(4)).toBe(0.2);
    expect(headerShare(400)).toBe(HEADER_SHARE_MIN);
    expect(headerRoom({ w: 100, h: 100 }, 1)).toBeCloseTo(40, 9);
    expect(headerRoom({ w: 100, h: 100 }, 400)).toBeCloseTo(20, 9);
    expect(headerRoom({ w: 1e6, h: 100 }, 1)).toBeCloseTo(40, 9);
    expect(fitScale({ w: 1e6, h: 1e6 }, label, twoLines)).toBeLessThanOrEqual(1 + 1e-9);
    // A level's scale is the largest that LEVEL_FIT_SHARE of its boxes, counted by size, can hold: small boxes do not drag it down.
    expect(LEVEL_FIT_SHARE).toBe(0.75);
    expect(levelScale([1, 2, 3, 4].map((fit) => ({ fit, size: 1 })))).toBe(2);
    expect(levelScale([{ fit: 0.1, size: 1 }, { fit: 2, size: 10 }])).toBe(2);
    expect(levelScale([{ fit: 0, size: 1 }])).toBe(0);
    for (const map of [...maps(), wide(1, 6), wide(3, 4)]) {
      for (const level of map.byLevel) {
        // One text scale for every box at a level.
        for (const n of level) expect(n.text, n.id).toBe(level[0].text);
      }
      for (const n of map.nodes.values()) {
        if (n.children.length === 0 || !n.fits) { if (n.children.length > 0) expect(n.header, n.id).toBe(0); continue; }
        expect(n.header).toBeGreaterThan(0);
        expect(n.header).toBeLessThanOrEqual(headerRoom(n, leafCount(map, n.id)) + eps);
      }
    }
    // At least LEVEL_FIT_SHARE of each level, counted by size, fits its scale.
    for (const map of [...maps(), wide(1, 6), wide(3, 4)]) {
      for (const level of map.byLevel) {
        const size = (ns: readonly { w: number; h: number }[]) => ns.reduce((sum, n) => sum + Math.sqrt(n.w * n.h), 0);
        if (level[0].text > 0) expect(size(level.filter((n) => map.nodes.get(n.id)!.fits))).toBeGreaterThanOrEqual(LEVEL_FIT_SHARE * size(level) - eps);
      }
    }
    // Built once per index: the same map object, whatever the focus.
    const index = testIndex();
    expect(nestedMap(index, 'P')).toBe(nestedMap(index, 'P'));
  });
});
