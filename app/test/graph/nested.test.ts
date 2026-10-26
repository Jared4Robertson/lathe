import { describe, expect, it } from 'vitest';
import { graphMap, MAX_LEVEL_STEP, settleLevelScale, typicalSize } from '../../src/graph/map';
import { LABEL_PAD, labelHeight, LINE_HEIGHT, linesIn, mapLabel, narrowestWidth, TITLE_FONT, titleWidth, WIDTH_MARGIN, wordsFit } from '../../src/graph/text';
import { layoutNested, leafSide, NEST_PAD, nestedMap, shelfPack, type NestedMap } from '../../src/graph/nested';
import { indexWorkspace } from '../../src/specs/data';
import { groupedWorkspace, heightLevels, manyOfOneKindWorkspace, testIndex } from './workspace';

// The Nested map (LA-EXP-DR62): the Tree map's tree as nested squares, each box holding its children
// below its header band, packed in rows in the tree's order, sized to its content, laid out once.

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

  it('LA-EXP-T185 Every box is a square, sized to its content: a leaf the least that holds its label, a parent the least that holds its header and its children', () => {
    for (const map of [...maps(), wide(1, 6), wide(3, 4)]) {
      for (const n of map.nodes.values()) {
        expect(n.w, n.id).toBe(n.h);
        expect(n.w, n.id).toBeGreaterThan(0);
      }
    }
    // A leaf of a synthetic tree (its ID its title) is the least square for its label at its scale.
    for (const n of wide(3, 4).nodes.values()) if (n.children.length === 0) expect(n.w, n.id).toBeCloseTo(n.text * leafSide({ title: n.id, meta: '' }), 6);
    // A parent is no bigger than it must be: its children's block, inside its padding, reaches its bottom or its right side
    // (or, for a short block, it is as wide as its label's widest word), give or take the one header line its least width saves.
    for (const index of [testIndex(), indexWorkspace(groupedWorkspace()), indexWorkspace(manyOfOneKindWorkspace())]) {
      const map = nestedMap(index, 'P');
      for (const n of map.nodes.values()) {
        if (n.children.length === 0) continue;
        const kids = n.children.map((c) => map.nodes.get(c)!);
        const right = Math.max(...kids.map((k) => k.x + k.w)) + NEST_PAD * n.text;
        const bottom = Math.max(...kids.map((k) => k.y + k.h)) + NEST_PAD * n.text;
        const word = narrowestWidth(mapLabel(index, n.id), false) * n.text;
        expect(Math.min(n.x + n.w - right, n.y + n.h - bottom, n.w - word), n.id).toBeLessThan(1e-3 * n.w + LINE_HEIGHT * TITLE_FONT * n.text);
      }
    }
    // Size follows content, not records: a parent of more children is bigger.
    const lop = layoutNested(['r'], (id) => (id === 'r' ? ['a', 'b'] : id === 'a' ? ['a1', 'a2', 'a3'] : id === 'b' ? ['b1'] : []));
    expect(lop.nodes.get('a')!.w).toBeGreaterThan(lop.nodes.get('b')!.w);
    expect(leafCount(lop, 'r')).toBe(4);
  });

  it('LA-EXP-T186 Children are packed in rows in the tree order, a gap apart, within the row width', () => {
    // Four equal squares in a row width of two: a 2 by 2 grid, in reading order.
    const grid = shelfPack([10, 10, 10, 10], 25, 2);
    expect(grid.at).toEqual([{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 0, y: 12 }, { x: 12, y: 12 }]);
    expect([grid.w, grid.h]).toEqual([22, 22]);
    // A row is as tall as its tallest square; the next starts below it, and order is kept.
    const rows = shelfPack([10, 20, 5, 30], 40, 1);
    expect(rows.at).toEqual([{ x: 0, y: 0 }, { x: 11, y: 0 }, { x: 32, y: 0 }, { x: 0, y: 21 }]);
    expect([rows.w, rows.h]).toEqual([37, 51]);
    // A square wider than the row stands alone; nothing, nothing.
    expect(shelfPack([50], 10, 1)).toEqual({ w: 50, h: 50, at: [{ x: 0, y: 0 }] });
    expect(shelfPack([], 10, 1)).toEqual({ w: 0, h: 0, at: [] });
  });

  it('LA-EXP-T187 One text scale per level, from its typical box size, at most 3 times the level below, and every square sized to hold its label at it', () => {
    // A leaf's least square holds its label at scale 1, every word across and its lines within it, and no smaller one does.
    const label = { title: 'Walk the model as a graph', meta: 'Use case · LA-EXP-UC03' };
    const least = leafSide(label);
    expect(wordsFit(label, least, true)).toBe(true);
    expect(labelHeight(linesIn(label, least, true))).toBeLessThanOrEqual(least + eps);
    const less = least * 0.99;
    expect(!wordsFit(label, less, true) || labelHeight(linesIn(label, less, true)) > less).toBe(true);
    // A level's typical box size is its median by area; its scale, that size over a leaf's, settled with the
    // boxes' areas at it, never below the level below's nor more than MAX_LEVEL_STEP times it.
    expect(typicalSize([1, 1, 1, 100])).toBe(10);
    expect(typicalSize([4, 4, 4])).toBe(2);
    const leaf = 100 * 100;
    expect(settleLevelScale(() => [leaf], 1, leaf)).toBe(1);
    expect(settleLevelScale(() => [4 * leaf, 4 * leaf], 1, leaf)).toBeCloseTo(2, 9);
    expect(settleLevelScale(() => [400 * leaf], 2, leaf)).toBe(MAX_LEVEL_STEP * 2);
    expect(settleLevelScale(() => [leaf], 2, leaf)).toBe(2);
    // Boxes whose least area grows with the scale settle with it, only ever growing.
    expect(settleLevelScale((s) => [leaf * 2 * s], 1, leaf)).toBeGreaterThan(Math.sqrt(2));
    // A leaf whose label needs more room gets it: a long title takes a bigger box than a short one beside it, at the same text.
    const long = 'A title long enough to need much more room than one record would be given in this map, '.repeat(4).trim();
    const lop = layoutNested(['r'], (id) => (id === 'r' ? ['a', 'b'] : []), (id) => ({ title: id === 'a' ? long : 'B', meta: 'Use case · LA-EXP-UC99' }));
    const [a, b] = [lop.nodes.get('a')!, lop.nodes.get('b')!];
    expect(a.text).toBe(b.text);
    expect(a.w * a.h).toBeGreaterThan(b.w * b.h);
    for (const map of [...maps(), wide(1, 6), wide(3, 4), lop]) {
      // Every box at one height level has the same text scale, whatever its size: 1 or more at the leaves, at most MAX_LEVEL_STEP times the level below's.
      heightLevels(map.nodes).forEach((boxes, h, levels) => {
        for (const n of boxes) expect(n.text, n.id).toBe(boxes[0].text);
        const below = h > 0 ? levels[h - 1][0].text : 1;
        expect(boxes[0].text).toBeGreaterThanOrEqual(below);
        expect(boxes[0].text).toBeLessThanOrEqual(MAX_LEVEL_STEP * below * (1 + 1e-9));
      });
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
