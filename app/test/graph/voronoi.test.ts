import { describe, expect, it } from 'vitest';
import { indexOf } from '../fixtures/load';
import { drawnNested, frameNested, MAX_DRAWN, MIN_DRAWN, viewRect } from '../../src/graph/camera';
import { graphMap, MAP_SIZE } from '../../src/graph/map';
import { LABEL_PAD, metaWidth, titleWidth } from '../../src/graph/text';
import {
  below, bounds, cellText, chord, contains, hexagon, holds, inset, layoutTreeOf, layoutVoronoi, polygonArea, PRODUCT_AREA, readyVoronoiMap, voronoiCells, voronoiTree, type VoronoiMap,
} from '../../src/graph/voronoi';
import type { SpecIndex } from '../../src/specs/data';
import { groupedWorkspace, manyOfOneKindWorkspace, siblingGroups, testIndex } from './workspace';

// The Voronoi map (LA-EXP-DS08): the Tree map's tree as a Voronoi treemap, laid out once, top-down
// from the product's fixed hexagon by one rule (LA-EXP-DS06): siblings are the same size (equal
// areas), with the same text.

type XY = [number, number];
/** The test workspaces' indexes, built once, so a map found by its index is the one the test laid out. */
let built: SpecIndex[] | null = null;
const indexes = (): SpecIndex[] => (built ??= [testIndex(), indexOf(groupedWorkspace()), indexOf(manyOfOneKindWorkspace())]);
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
  it('LA-EXP-DS08-T01 Each cell holds its children inside its outline, below its header, none overlapping, over the same tree as the Tree map', () => {
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

  it("LA-EXP-DS08-T01 The product is a fixed flat-topped hexagon, and each parent's cell splits into equal-area cells, within about 5%, whatever the records under them", () => {
    for (const map of [uneven([40, 3, 12, 1, 25, 8, 8]), ...maps(), wide(1, 6)]) {
      const root = map.nodes.get(map.roots[0])!;
      expect(root.polygon).toHaveLength(6);
      expect(polygonArea(root.polygon)).toBeCloseTo(PRODUCT_AREA, -2);
      expect(root.w).toBeCloseTo(MAP_SIZE, 6);
      expect(root.polygon.filter(([, y]) => y === 0)).toHaveLength(2);
    }
    expect(polygonArea(hexagon(1000))).toBeCloseTo(1000, 6);
    // Siblings' areas: within 5% of their mean for at least 95% of all cells across the test maps, however many records each holds.
    let close = 0;
    let all = 0;
    for (const m of [uneven([40, 3, 12, 1, 25, 8, 8]), ...maps(), wide(1, 6), wide(2, 5)]) {
      for (const group of siblingGroups(m)) {
        if (group.length < 2) continue;
        const mean = group.reduce((s, k) => s + polygonArea(k.polygon), 0) / group.length;
        for (const k of group) {
          all++;
          if (Math.abs(polygonArea(k.polygon) / mean - 1) <= 0.05) close++;
        }
      }
    }
    expect(close / all).toBeGreaterThanOrEqual(0.95);
  });

  it('LA-EXP-DS08-T01 The same tree always gives the same map, and adding a record moves nothing outside its parent', () => {
    expect(uneven([50, 30, 20])).toEqual(uneven([50, 30, 20]));
    const before = uneven([50, 30, 20]);
    const after = uneven([50, 30, 20], 'c0');
    // Every cell outside c0, and c0 itself, keeps its place exactly.
    for (const n of before.nodes.values()) {
      if (n.id.startsWith('c0.')) continue;
      expect(after.nodes.get(n.id)!.polygon, n.id).toEqual(n.polygon);
    }
    // The same shape anywhere, at any size, splits the same way.
    const sites = ['a', 'b', 'c'];
    const small = voronoiCells(hexagon(100), sites);
    const big = voronoiCells(hexagon(100).map(([x, y]): XY => [x * 10 + 500, y * 10 - 20]), sites);
    for (const [id, cell] of small) big.get(id)!.forEach(([x, y], i) => { expect((x - 500) / 10).toBeCloseTo(cell[i][0], 6); expect((y + 20) / 10).toBeCloseTo(cell[i][1], 6); });
  });

  it("LA-EXP-DS06-T11 LA-EXP-DS08-T02 Siblings share one text scale, at most their size's, and each label wraps on whole words inside its outline", () => {
    for (const map of [...maps(), wide(2, 5), uneven([40, 3, 12, 1, 25])]) {
      for (const group of siblingGroups(map)) {
        // One scale, no more than the smallest sibling's size allows.
        for (const n of group) expect(n.text, n.id).toBe(group[0].text);
        expect(group[0].text).toBeGreaterThan(0);
        expect(group[0].text).toBeLessThanOrEqual(Math.min(...group.map((n) => cellText(n.polygon))) * (1 + 1e-9));
      }
      for (const n of map.nodes.values()) {
        expect(holds(n.polygon, n.label), `${n.id}'s label inside it`).toBe(true);
        // No word is broken: every line but the last ends after a space.
        for (const line of n.lines.title.slice(0, -1)) expect(/\s$/.test(line), `${n.id}: "${line}"`).toBe(true);
        const width = n.label.w / n.text - 2 * LABEL_PAD;
        for (const line of n.lines.title) expect(titleWidth(line.trimEnd())).toBeLessThanOrEqual(width + 1e-6);
        for (const line of n.lines.meta) expect(metaWidth(line.trimEnd())).toBeLessThanOrEqual(width + 1e-6);
        // A parent's label is in its header, above where its children start.
        if (n.children.length > 0) expect(n.label.y + n.label.h).toBeLessThanOrEqual(n.cut + 1e-6);
      }
    }
  });

  it('LA-EXP-DS06-T11 An index keeps one map whatever the focus, and the worker lays out the same tree the same way', () => {
    const index = testIndex();
    expect(readyVoronoiMap(index, 'P')).toBe(readyVoronoiMap(index, 'P'));
    // A spec loaded again with the same tree and labels gets the same map at once.
    expect(readyVoronoiMap(testIndex(), 'P')).toBe(readyVoronoiMap(index, 'P'));
    // The worker lays out the tree the index gives (`voronoiTree`), exactly as here.
    expect(layoutTreeOf(voronoiTree(index, 'P').tree)).toEqual(readyVoronoiMap(index, 'P'));
  });

  it('LA-EXP-DS08-T01 The convex helpers inset, cut and cross polygons', () => {
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
  it('LA-EXP-DS09-T14 The camera frames the focus cell; what is drawn is in view, big enough, a parent before its children, within the budget', () => {
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
