import { describe, expect, it } from 'vitest';
import { drawnNested, frameNested, MAX_DRAWN, MIN_DRAWN, viewRect } from '../../src/graph/camera';
import { graphMap, MAX_LEVEL_STEP } from '../../src/graph/map';
import { LABEL_PAD, metaWidth, titleWidth, WIDTH_MARGIN } from '../../src/graph/text';
import {
  below, bounds, chord, contains, hexagon, holds, inset, layoutTreeOf, layoutVoronoi, LEAF_AREA, polygonArea, quantize, readyVoronoiMap, voronoiCells, voronoiTree, WEIGHT_STEP, type VoronoiMap,
} from '../../src/graph/voronoi';
import { indexWorkspace, type SpecIndex } from '../../src/specs/data';
import { groupedWorkspace, heightLevels, manyOfOneKindWorkspace, testIndex } from './workspace';

// The Voronoi map (LA-EXP-DR64): the Tree map's tree as a Voronoi treemap, the product a hexagon,
// each cell split into its children's cells by a power diagram, sized by the leaf records under
// it, laid out once; each cell's label at its level's text scale (LA-EXP-DR58).

type XY = [number, number];
const indexes = (): SpecIndex[] => [testIndex(), indexWorkspace(groupedWorkspace()), indexWorkspace(manyOfOneKindWorkspace())];
const maps = (): VoronoiMap[] => indexes().map((index) => readyVoronoiMap(index, 'P')!);

/** A synthetic tree: `n` roots, each with `k` children, each with `k` leaves. */
function wide(n: number, k: number): VoronoiMap {
  const kids = (id: string): string[] => (id.split('.').length >= 3 ? [] : Array.from({ length: k }, (_, i) => `${id}.${i}`));
  return layoutVoronoi(Array.from({ length: n }, (_, i) => `r${i}`), kids);
}
/** A tree of uneven sizes: one root, `sizes.length` children, child i with sizes[i] leaves. */
function uneven(sizes: readonly number[], extra?: string): VoronoiMap {
  const kids = (id: string): string[] => {
    if (id === 'root') return sizes.map((_, i) => `c${i}`);
    const m = /^c(\d+)$/.exec(id);
    if (!m) return [];
    const own = Array.from({ length: sizes[Number(m[1])] }, (_, j) => `${id}.${j}`);
    return extra && id === extra ? [...own, `${id}.extra`] : own;
  };
  return layoutVoronoi(['root'], kids);
}

const leafCount = (map: VoronoiMap, id: string): number => {
  const n = map.nodes.get(id)!;
  return n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + leafCount(map, c), 0);
};
/** The overlap of two convex polygons: one clipped by each edge of the other. */
function overlap(a: readonly XY[], b: readonly XY[]): number {
  let out: readonly XY[] = a;
  const s = Math.sign(b.reduce((sum, p, i) => { const q = b[(i + 1) % b.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0)) || 1;
  for (let i = 0; i < b.length && out.length >= 3; i++) {
    const [x0, y0] = b[i];
    const [x1, y1] = b[(i + 1) % b.length];
    out = clipBy(out, -s * (y1 - y0), s * (x1 - x0), x0, y0);
  }
  return out.length >= 3 ? polygonArea(out) : 0;
}
function clipBy(p: readonly XY[], a: number, b: number, x0: number, y0: number): XY[] {
  const side = (q: XY) => a * (q[0] - x0) + b * (q[1] - y0);
  const out: XY[] = [];
  for (let i = 0; i < p.length; i++) {
    const cur = p[i];
    const next = p[(i + 1) % p.length];
    const sc = side(cur);
    const sn = side(next);
    if (sc >= 0) out.push(cur);
    if ((sc >= 0) !== (sn >= 0)) { const t = sc / (sc - sn); out.push([cur[0] + t * (next[0] - cur[0]), cur[1] + t * (next[1] - cur[1])]); }
  }
  return out;
}
/** Every corner of `inner` inside `outer`, give or take a hair. */
const within = (inner: readonly XY[], outer: readonly XY[]) => {
  const eps = Math.sqrt(polygonArea(outer)) * 1e-6;
  return inner.every((p) => contains(outer, p) || nearEdge(outer, p, eps));
};
const nearEdge = (poly: readonly XY[], [x, y]: XY, eps: number) => poly.some(([x0, y0], i) => {
  const [x1, y1] = poly[(i + 1) % poly.length];
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  return Math.abs((x1 - x0) * (y - y0) - (y1 - y0) * (x - x0)) / len <= eps;
});

describe('the Voronoi map', () => {
  it('LA-EXP-T191 Each cell holds its children inside its outline, below its header, none overlapping, over the same tree as the Tree map', () => {
    for (const map of [...maps(), wide(1, 6), wide(3, 4), uneven([40, 3, 12, 1, 25])]) {
      for (const n of map.nodes.values()) {
        expect(n.polygon.length).toBeGreaterThanOrEqual(3);
        // Every cell is convex, and its bounding box is its node's box.
        const b = bounds(n.polygon);
        expect([n.x, n.y, n.w, n.h]).toEqual([b.x, b.y, b.w, b.h]);
        if (n.children.length === 0) continue;
        const kids = n.children.map((c) => map.nodes.get(c)!);
        for (const k of kids) {
          expect(k.level).toBe(n.level + 1);
          expect(k.parent).toBe(n.id);
          expect(within(k.polygon, n.polygon), `${k.id} inside ${n.id}`).toBe(true);
          for (const [, y] of k.polygon) expect(y).toBeGreaterThanOrEqual(n.cut - 1e-6 * n.h);
          expect(k.order).toBeGreaterThan(n.order);
        }
        for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
          expect(overlap(kids[i].polygon, kids[j].polygon), `${kids[i].id} and ${kids[j].id}`).toBeLessThan(1e-6 * polygonArea(n.polygon));
        }
      }
    }
    // The tree is the Tree map's, children in the same order.
    const index = testIndex();
    const tree = graphMap(index, 'P');
    const voronoi = readyVoronoiMap(index, 'P')!;
    expect(voronoi.roots).toEqual(tree.roots);
    for (const n of tree.nodes.values()) expect(voronoi.nodes.get(n.id)!.children).toEqual(n.children);
  });

  it('LA-EXP-T191 The product is a flat-topped hexagon in proportion to its leaves, and each cell is within about 5% of its share of its parent', () => {
    const map = uneven([40, 3, 12, 1, 25, 8, 8]);
    const root = map.nodes.get('root')!;
    expect(root.polygon).toHaveLength(6);
    expect(polygonArea(root.polygon)).toBeCloseTo(quantize(97) * LEAF_AREA, -2);
    expect(root.polygon.filter(([, y]) => y === 0)).toHaveLength(2);
    const hex = hexagon(1000);
    expect(polygonArea(hex)).toBeCloseTo(1000, 6);
    // Shares of the parent: within 5% for at least 95% of all cells across the test maps.
    let close = 0;
    let all = 0;
    for (const m of [map, ...maps(), wide(1, 6), wide(2, 5)]) {
      for (const n of m.nodes.values()) {
        if (n.children.length < 2) continue;
        const kids = n.children.map((c) => m.nodes.get(c)!);
        const area = kids.reduce((s, k) => s + polygonArea(k.polygon), 0);
        const leaves = kids.reduce((s, k) => s + leafCount(m, k.id), 0);
        for (const k of kids) {
          all++;
          if (Math.abs(polygonArea(k.polygon) / area / (leafCount(m, k.id) / leaves) - 1) <= 0.05) close++;
        }
      }
    }
    expect(close / all).toBeGreaterThanOrEqual(0.95);
    // A weight is rounded to within 2%.
    for (const w of [1, 2, 3, 7, 50, 51, 999]) expect(Math.abs(quantize(w) / w - 1)).toBeLessThanOrEqual(WEIGHT_STEP - 1);
  });

  it('LA-EXP-T191 The same tree always gives the same map, and adding a record moves nothing outside the parent whose rounded weight it changes', () => {
    expect(uneven([50, 40, 20])).toEqual(uneven([50, 40, 20]));
    const before = uneven([50, 40, 20]);
    const after = uneven([50, 40, 20], 'c0');
    // 50 and 51 leaves round to the same weight, and so do the product's 110 and 111, so the product and its split are the
    // same: every cell outside c0 keeps its place exactly.
    expect(quantize(50)).toBe(quantize(51));
    expect(quantize(110)).toBe(quantize(111));
    expect(after.width).toBe(before.width);
    for (const n of before.nodes.values()) {
      if (n.id === 'c0' || n.id.startsWith('c0.')) continue;
      expect(after.nodes.get(n.id)!.polygon, n.id).toEqual(n.polygon);
    }
    // The same shape anywhere, at any size, splits the same way.
    const sites = [{ id: 'a', weight: 3 }, { id: 'b', weight: 1 }, { id: 'c', weight: 2 }];
    const small = voronoiCells(hexagon(100), sites);
    const big = voronoiCells(hexagon(100).map(([x, y]): XY => [x * 10 + 500, y * 10 - 20]), sites);
    for (const [id, cell] of small) big.get(id)!.forEach(([x, y], i) => { expect((x - 500) / 10).toBeCloseTo(cell[i][0], 6); expect((y + 20) / 10).toBeCloseTo(cell[i][1], 6); });
  });

  it('LA-EXP-T192 One text scale per level; every cell sized to hold its label at it, wrapped on whole words inside its outline', () => {
    // A leaf whose label needs more than its share of records gets it: a long title takes a bigger cell than a short one beside it, at the same text.
    const long = 'A title long enough to need much more room than one record would be given in this map, '.repeat(4).trim();
    const lop = layoutVoronoi(['r'], (id) => (id === 'r' ? ['a', 'b', 'c'] : []), (id) => ({ title: id === 'a' ? long : id, meta: 'Use case · LA-EXP-UC99' }));
    const [a, b] = [lop.nodes.get('a')!, lop.nodes.get('b')!];
    expect(a.text).toBe(b.text);
    expect(polygonArea(a.polygon)).toBeGreaterThan(1.5 * polygonArea(b.polygon));
    for (const map of [...maps(), wide(2, 5), uneven([40, 3, 12, 1, 25]), lop]) {
      // Every cell at one height level has the same text scale, whatever its size, never smaller for a long title: at most MAX_LEVEL_STEP times the level below's.
      heightLevels(map.nodes).forEach((cells, h, levels) => {
        for (const n of cells) expect(n.text, n.id).toBe(cells[0].text);
        const below = h > 0 ? levels[h - 1][0].text : 1;
        expect(cells[0].text).toBeGreaterThanOrEqual(below);
        expect(cells[0].text).toBeLessThanOrEqual(MAX_LEVEL_STEP * below * (1 + 1e-9));
      });
      for (const n of map.nodes.values()) {
        expect(n.label.w, `${n.id} is labeled`).toBeGreaterThan(0);
        expect(holds(n.polygon, n.label), `${n.id}'s label inside it`).toBe(true);
        // No word is broken: every line but the last ends after a space.
        for (const line of n.lines.title.slice(0, -1)) expect(/\s$/.test(line), `${n.id}: "${line}"`).toBe(true);
        const width = n.label.w / n.text - 2 * LABEL_PAD;
        for (const line of n.lines.title) expect(titleWidth(line.trimEnd()) * WIDTH_MARGIN).toBeLessThanOrEqual(width + 1e-6);
        for (const line of n.lines.meta) expect(metaWidth(line.trimEnd()) * WIDTH_MARGIN).toBeLessThanOrEqual(width + 1e-6);
        // A parent's label is in its header, above where its children start.
        if (n.children.length > 0) expect(n.label.y + n.label.h).toBeLessThanOrEqual(n.cut + 1e-6);
      }
    }
  });

  it('LA-EXP-T192 An index keeps one map whatever the focus, and the worker lays out the same tree the same way', () => {
    const index = testIndex();
    expect(readyVoronoiMap(index, 'P')).toBe(readyVoronoiMap(index, 'P'));
    // A spec loaded again with the same tree and labels gets the same map at once.
    expect(readyVoronoiMap(testIndex(), 'P')).toBe(readyVoronoiMap(index, 'P'));
    // The worker lays out the tree the index gives (`voronoiTree`), exactly as here.
    expect(layoutTreeOf(voronoiTree(index, 'P').tree)).toEqual(readyVoronoiMap(index, 'P'));
  });

  it('LA-EXP-T191 The convex helpers inset, cut and cross polygons', () => {
    const square: XY[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(polygonArea(inset(square, 1))).toBeCloseTo(64, 9);
    expect(inset(square, 6)).toEqual([]);
    expect(polygonArea(below(square, 4))).toBeCloseTo(60, 9);
    expect(chord(square, 5)).toEqual([0, 10]);
    expect(chord(square, 11)).toBeNull();
    expect(holds(square, { x: 1, y: 1, w: 8, h: 8 })).toBe(true);
    expect(holds(square, { x: 1, y: 1, w: 10, h: 8 })).toBe(false);
  });
});

describe('graph camera in the Voronoi layout', () => {
  const map = readyVoronoiMap(testIndex(), 'P')!;
  it('LA-EXP-T193 The camera frames the focus cell; what is drawn is in view, big enough, a parent before its children, within the budget', () => {
    for (const focus of ['P', 'P-D', 'P-D-UC01']) {
      const n = map.nodes.get(focus)!;
      const v = frameNested(map, focus, 1000, 800);
      // Centered on the cell's box.
      expect((n.x + n.w / 2) * v.zoom + v.x).toBeCloseTo(500, 6);
      expect((n.y + n.h / 2) * v.zoom + v.y).toBeCloseTo(400, 6);
      const d = drawnNested(map, v, 1000, 800, [focus]);
      expect(d.boxes.length).toBeLessThanOrEqual(MAX_DRAWN);
      const rect = viewRect(v, 1000, 800);
      const at = new Map(d.boxes.map((b, i) => [b.id, i]));
      for (const b of d.boxes) {
        const c = map.nodes.get(b.id)!;
        expect(c.w * v.zoom).toBeGreaterThanOrEqual(MIN_DRAWN);
        expect(c.x + c.w >= rect.x0 && c.x <= rect.x1).toBe(true);
        if (c.parent && at.has(c.parent)) expect(at.get(c.parent)!).toBeLessThan(at.get(b.id)!);
      }
      expect(d.boxes.some((b) => b.id === focus)).toBe(true);
    }
  });
});
