import { describe, expect, it } from 'vitest';
import { graphMap, MAP_SIZE, sizeText } from '../../src/graph/map';
import { BORDER, LABEL_PAD, labelHeight, largestFit, mapLabel, metaWidth, narrowestWidth, titleWidth, type MapLabel } from '../../src/graph/text';
import { gridOf, HEADER_SHARE, layoutNested, NEST_GAP, NEST_PAD, nestedMap, type NestedMap, type NestedNode } from '../../src/graph/nested';
import { indexWorkspace, type SpecIndex } from '../../src/specs/data';
import { groupedWorkspace, manyOfOneKindWorkspace, siblingGroups, testIndex } from './workspace';

// The Nested map (LA-EXP-DR62): the Tree map's tree as nested squares, laid out once, top-down from
// the product's square by one rule (LA-EXP-DR58): siblings are the same size, with the same text.

const indexes = (): SpecIndex[] => [testIndex(), indexWorkspace(groupedWorkspace()), indexWorkspace(manyOfOneKindWorkspace())];
const maps = (): NestedMap[] => indexes().map((index) => nestedMap(index, 'P'));

/** A synthetic tree: `n` roots, each with `k` children, each with `k` leaves. */
function wide(n: number, k: number): NestedMap {
  const kids = (id: string): string[] => (id.split('.').length >= 3 ? [] : Array.from({ length: k }, (_, i) => `${id}.${i}`));
  return layoutNested(Array.from({ length: n }, (_, i) => `r${i}`), kids);
}
/** A product with a busy part (seven children of five leaves) and a quiet one (one leaf), each leaf with a word too wide for its size share. */
const long = 'A title with a word too wide for a box at its size share: Extraordinarilylongunbrokenidentifierthatnoboxcanholdonlineandthatkeepsongoingwellpastanyboxwidth';
function busyAndQuiet(): NestedMap {
  const kids = (id: string): string[] => (id === 'p' ? ['busy', 'quiet'] : id === 'busy' ? Array.from({ length: 7 }, (_, i) => `b${i}`) : /^b\d$/.test(id) ? Array.from({ length: 5 }, (_, j) => `${id}.${j}`) : id === 'quiet' ? ['q0'] : []);
  return layoutNested(['p'], kids, (id) => ({ title: id.includes('.') ? long : id, meta: 'Use case · LA-EXP-UC99' }));
}
const all = (): NestedMap[] => [...maps(), wide(1, 6), wide(3, 4), busyAndQuiet()];
const eps = 1e-6;

/** The border a box's label keeps clear of, as the map sizes it. */
const borderOf = (n: NestedNode) => BORDER * Math.max(0.5, n.text);

describe('the Nested map', () => {
  it('LA-EXP-T185 Each box holds its children below its header band, inside its padding, none overlapping, over the same tree as the Tree map', () => {
    for (const map of all()) {
      for (const n of map.nodes.values()) {
        if (n.children.length === 0) { expect(n.header).toBe(0); continue; }
        const pad = NEST_PAD * sizeText(n.w);
        const kids = n.children.map((c) => map.nodes.get(c)!);
        for (const k of kids) {
          expect(k.level).toBe(n.level + 1);
          expect(k.parent).toBe(n.id);
          // Inside the box, inside its padding, below the header band.
          expect(k.x).toBeGreaterThanOrEqual(n.x + pad - eps * n.w);
          expect(k.y).toBeGreaterThanOrEqual(n.y + Math.max(n.header, pad) - eps * n.w);
          expect(k.x + k.w).toBeLessThanOrEqual(n.x + n.w - pad + eps * n.w);
          expect(k.y + k.h).toBeLessThanOrEqual(n.y + n.h - pad + eps * n.w);
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

  it('LA-EXP-T185 Top-down from the product\'s fixed square, siblings are equal squares: a busy parent packs its children smaller, and record counts size nothing', () => {
    for (const map of all()) {
      for (const r of map.roots) expect(map.nodes.get(r)!.w).toBe(MAP_SIZE);
      for (const group of siblingGroups(map)) {
        for (const n of group) {
          expect(n.w, n.id).toBe(n.h);
          expect(n.w, n.id).toBe(group[0].w);
        }
      }
    }
    // The busy part and the quiet one are the same size; the busy one's children are smaller than the quiet one's, its long titles notwithstanding.
    const map = busyAndQuiet();
    const [busy, quiet] = ['busy', 'quiet'].map((id) => map.nodes.get(id)!);
    expect(busy.w).toBe(quiet.w);
    expect(map.nodes.get('b0')!.w).toBeLessThan(map.nodes.get('q0')!.w);
  });

  it('LA-EXP-T186 Children are a grid of equal squares in the tree order, with the column count that makes them largest, the room it leaves blank', () => {
    // Four squares in a square room: two by two. Five in a wide room: one row.
    expect(gridOf(4, 100, 100, 0)).toEqual({ side: 50, columns: 2, rows: 2 });
    expect(gridOf(5, 500, 100, 0)).toEqual({ side: 100, columns: 5, rows: 1 });
    // Three in a square room: two columns, the last cell of the second row blank; the gap comes off the side.
    expect(gridOf(3, 100, 100, 10)).toEqual({ side: 45, columns: 2, rows: 2 });
    // No other column count gives larger squares.
    for (const n of [1, 2, 3, 7, 12, 31]) {
      const best = gridOf(n, 300, 200, 4);
      for (let c = 1; c <= n; c++) expect(Math.min((300 - (c - 1) * 4) / c, (200 - (Math.ceil(n / c) - 1) * 4) / Math.ceil(n / c))).toBeLessThanOrEqual(best.side + eps);
    }
    // In a map, a parent's children run in the tree's order, row by row, a gap apart.
    for (const map of all()) {
      for (const n of map.nodes.values()) {
        if (n.children.length === 0) continue;
        const kids = n.children.map((c) => map.nodes.get(c)!);
        const gap = NEST_GAP * sizeText(n.w);
        const columns = new Set(kids.map((k) => k.x)).size;
        kids.forEach((k, i) => {
          expect(k.x - kids[i % columns].x).toBeCloseTo(0, 6);
          if (i % columns > 0) expect(k.x - kids[i - 1].x).toBeCloseTo(k.w + gap, 6);
          if (i >= columns) expect(k.y - kids[i - columns].y).toBeCloseTo(k.w + gap, 6);
        });
      }
    }
  });

  it('LA-EXP-T187 Siblings share one text scale, their side over TEXT_SIZE or the largest at which every sibling\'s whole label fits, and one header band', () => {
    for (const map of all()) {
      for (const group of siblingGroups(map)) {
        const most = sizeText(group[0].w);
        const text = group[0].text;
        for (const n of group) expect(n.text, n.id).toBe(text);
        expect(text).toBeLessThanOrEqual(most);
        expect(text).toBeGreaterThan(0);
        // The largest that fits: the size's share, or one sibling's label fills its room.
        const fits = group.map((n) => largestFit(labelOf(map, n), n.centered, n.w, n.centered ? n.w : HEADER_SHARE * n.w, most, (s) => BORDER * Math.max(0.5, s)));
        expect(text).toBeCloseTo(Math.min(...fits), 9);
        // One header band for the parents among them: the tallest of their labels.
        const parents = group.filter((n) => n.children.length > 0);
        for (const n of parents) expect(n.header).toBeCloseTo(Math.max(...parents.map((p) => text * labelHeight(p.lines))), 6);
      }
    }
    // A long title in a busy part lowers its siblings' text with its own, never its cousins'.
    const map = busyAndQuiet();
    const leaf = map.nodes.get('b0.0')!;
    expect(leaf.text).toBeLessThan(sizeText(leaf.w));
    expect(map.nodes.get('b1.0')!.text).toBe(leaf.text);
    expect(map.nodes.get('b0')!.text).toBe(sizeText(map.nodes.get('b0')!.w));
    // Built once per index: the same map object, whatever the focus.
    const index = testIndex();
    expect(nestedMap(index, 'P')).toBe(nestedMap(index, 'P'));
  });

  it('LA-EXP-T187 Every label fits its box: no word broken, a leaf\'s lines inside its square, a parent\'s inside its header band', () => {
    for (const map of all()) {
      for (const n of map.nodes.values()) {
        const label = labelOf(map, n);
        const across = (n.w - 2 * borderOf(n)) / n.text;
        expect(across).toBeGreaterThanOrEqual(narrowestWidth(label, n.centered) - eps);
        for (const line of n.lines.title) expect(titleWidth(line.trimEnd()), n.id).toBeLessThanOrEqual(across - 2 * LABEL_PAD + eps);
        for (const line of n.lines.meta) expect(metaWidth(line.trimEnd()), n.id).toBeLessThanOrEqual(across - 2 * LABEL_PAD + eps);
        expect(n.lines.title.join('')).toBe(label.title);
        const height = n.text * labelHeight(n.lines) + 2 * borderOf(n);
        if (n.children.length === 0) expect(height, n.id).toBeLessThanOrEqual(n.h * (1 + eps));
        else expect(height, n.id).toBeLessThanOrEqual(HEADER_SHARE * n.h * (1 + eps));
      }
    }
  });
});

/** A box's label as its map was given it: the real index's, or a synthetic tree's (its ID its title). */
function labelOf(map: NestedMap, n: NestedNode): MapLabel {
  for (const index of indexes()) if (nestedMap(index, 'P') === map) return mapLabel(index, n.id);
  return { title: n.lines.title.join(''), meta: n.lines.meta.join('') };
}
