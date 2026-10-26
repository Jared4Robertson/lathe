import type { SpecIndex } from '../specs/data';
import { contentScale, NODE_HEIGHT, NODE_WIDTH } from './layout';
import { isCentered, labelFor, labelHeight, textScaleOf } from './text';
import { treeChildren, treeParent } from './tree';

// The graph's one map per product (LA-EXP-DR57): the product's tree, the nav's (tree.ts), with the
// product as its single root, laid out once per spec load as one icicle. Nothing of another product
// is in it: each product is a space of its own. Every node has one place and one size in it,
// whatever is in focus: focusing anything moves the camera (camera.ts), never the map.
//
// - Every node in one level (its depth in the tree, a product at 0) has the same width
//   (LA-EXP-DR58), in proportion to the level's typical height (its median by height: the height of
//   the node a point of the level most likely lies in), never narrower than the level below nor more
//   than MAX_LEVEL_STEP times as wide, and the product's level no more than MAX_ROOT_STEP times, so it
//   stays usable. The gap between two siblings, and between two levels, grows with the width.
// - Every node in a level has one text scale, the level's width over a leaf's (text.ts), so a
//   parent's text is at most MAX_LEVEL_STEP times its child's. A label wraps on whole words.
// - A leaf is as tall as NODE_HEIGHT, or as its wrapped label needs at its level's text scale if
//   taller. A parent is exactly as tall as its children stacked, the gaps between them included,
//   and their stack starts at its top edge. A parent whose own label needs more room than its stack
//   (one short child in a wide level) passes the difference down to its last leaf, so the stack
//   still fills it exactly.
// - A leaf's height and its level's width depend on each other: each level settles them together,
//   from its typical height, before the level above is sized.
// - Filters do not change the map: a hidden kind is not drawn, but keeps its place.
//
// Pure and deterministic: the same index always gives the same map, and it is built once per index.

/** How wide a level is for its typical height: the width over the height. */
export const LEVEL_ASPECT = 1;
/** The most one level is wider than the level below it (LA-EXP-DR58). */
export const MAX_LEVEL_STEP = 3;
/** The most the root's level (the product) is wider than the level below it, so a product's picture leaves room for its domains. */
export const MAX_ROOT_STEP = 1.5;
/** The gap between two sibling leaves, and between a leaf level and the level before it. */
export const ROW_GAP = 16;
export const COLUMN_GAP = 64;

export interface MapNode {
  id: string;
  parent: string | null;
  children: readonly string[];
  /** The depth in the tree: 0 for a root (a product). */
  level: number;
  /** Top-left corner and size, in world coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Its label's scale (LA-EXP-DR58): its level's width over a leaf's, fixed by the map. */
  text: number;
}

export interface MapLevel {
  /** Its left edge and its width, shared by every node in it, in proportion to its typical height within the caps; its gaps grow with it. */
  x: number;
  width: number;
  /** The text scale of every box in it: its width over a leaf's. */
  text: number;
  /** The gap between two siblings in it. */
  rowGap: number;
}

/** What both views' maps share (the Tree map here, the Nested map in nested.ts): what the camera, the minimap and the filters read. */
export interface PlacedMap {
  /** Which view it lays out (LA-EXP-UC03-R16). */
  view: 'tree' | 'nested' | 'voronoi';
  nodes: ReadonlyMap<string, MapNode>;
  /** The roots, top to bottom: the product (or the top of a tree no product reaches). */
  roots: readonly string[];
  /** The nodes of each level, in the tree's order (top to bottom in the Tree map). */
  byLevel: readonly (readonly MapNode[])[];
  /** The whole map's size; it starts at (0, 0). */
  width: number;
  height: number;
}

export interface GraphMap extends PlacedMap {
  view: 'tree';
  levels: readonly MapLevel[];
}

/** The typical height of a level: its median weighted by height, so a level of a few tall nodes and many short ones takes the tall ones' scale. */
export function typicalHeight(heights: readonly number[]): number {
  if (heights.length === 0) return NODE_HEIGHT;
  const sorted = [...heights].sort((a, b) => a - b);
  const half = sorted.reduce((sum, h) => sum + h, 0) / 2;
  let seen = 0;
  for (const h of sorted) { seen += h; if (seen >= half) return h; }
  return sorted[sorted.length - 1];
}
/** A level's typical box size: the median of the square root of its boxes' areas, weighted by area, as a Tree level's typical height. */
export function typicalSize(areas: readonly number[]): number {
  const sorted = [...areas].sort((a, b) => a - b);
  const half = sorted.reduce((s, a) => s + a, 0) / 2;
  let seen = 0;
  for (const a of sorted) { seen += a; if (seen >= half) return Math.sqrt(a); }
  return Math.sqrt(sorted.at(-1) ?? 0);
}

/**
 * A height level's text scale in the Nested map (LA-EXP-DR62), a box's
 * level being its height from the leaves: its typical box size over a leaf's, never below the
 * level below's (`below`, 1 for the leaves) nor
 * more than MAX_LEVEL_STEP times it. A box's planned area (`areasAt`: the larger of its share by
 * records and the least its label and children need at a scale) grows with the scale, so the two
 * settle together, only ever growing, as a Tree level's width and its leaves' heights do. Set once
 * when the map is built, from the leaves up.
 */
export function settleLevelScale(areasAt: (scale: number) => readonly number[], below: number, leafArea: number): number {
  const scaleFor = (areas: readonly number[]) => Math.min(MAX_LEVEL_STEP * below, Math.max(below, typicalSize(areas) / Math.sqrt(leafArea)));
  let s = scaleFor(areasAt(below));
  for (let round = 0; round < SETTLE_ROUNDS; round++) {
    const next = scaleFor(areasAt(s));
    if (next <= s * (1 + 1e-9)) break;
    s = next;
  }
  return s;
}

/** Even, so a box's middle is a whole pixel. */
const even = (n: number) => 2 * Math.round(n / 2);

/** The root of the map that holds a node: its product, or the top of its tree when no product reaches it. */
export function mapRootOf(index: SpecIndex, id: string): string {
  let at = id;
  const seen = new Set([at]);
  for (let up = treeParent(index, at); up !== null && !seen.has(up); up = treeParent(index, up)) { seen.add(up); at = up; }
  return at;
}

/** How many times a level settles its width and its leaves' heights together; it settles in two or three. */
const SETTLE_ROUNDS = 12;

/**
 * Lays out a tree given by its roots, a children function and, for each node, how tall its label
 * is at text scale 1, wrapped in a leaf's width, centered or not (exported for tests; no taller
 * than a leaf when not given).
 */
export function layoutTree(roots: readonly string[], childrenOf: (id: string) => readonly string[], labelHeightOf: (id: string, centered: boolean) => number = () => 0): GraphMap {
  // Levels, by a walk from the roots; a node reached twice keeps its first place.
  const parent = new Map<string, string | null>();
  const level = new Map<string, number>();
  const kids = new Map<string, string[]>();
  const byLevelIds: string[][] = [];
  const visit = (id: string, up: string | null, l: number) => {
    parent.set(id, up);
    level.set(id, l);
    (byLevelIds[l] ??= []).push(id);
    const own: string[] = [];
    kids.set(id, own);
    for (const c of childrenOf(id)) {
      if (level.has(c)) continue;
      own.push(c);
      visit(c, id, l + 1);
    }
  };
  const top: string[] = [];
  for (const r of roots) { if (!level.has(r)) { top.push(r); visit(r, null, 0); } }

  // Heights and widths, from the deepest level up: a level's heights need only the level below.
  const depth = byLevelIds.length;
  const h = new Map<string, number>();
  const widths: number[] = new Array(depth).fill(NODE_WIDTH);
  const rowGaps: number[] = new Array(depth).fill(ROW_GAP);
  const evenUp = (n: number) => 2 * Math.ceil(n / 2);
  for (let l = depth - 1; l >= 0; l--) {
    const ids = byLevelIds[l];
    const stack = ids.map((id) => {
      const own = kids.get(id)!;
      return own.length === 0 ? 0 : own.reduce((sum, k) => sum + h.get(k)!, 0) + rowGaps[l + 1] * (own.length - 1);
    });
    const below = l + 1 < depth ? widths[l + 1] : NODE_WIDTH;
    const cap = (l === 0 ? MAX_ROOT_STEP : MAX_LEVEL_STEP) * below;
    // A node's height at a width: a leaf's base height or its label's, a parent's stack or its label's.
    const heightsAt = (w: number) => {
      const text = textScaleOf(w);
      return ids.map((id, i) => {
        const leaf = stack[i] === 0;
        return Math.max(leaf ? NODE_HEIGHT : stack[i], evenUp(text * labelHeightOf(id, isCentered(text, !leaf))));
      });
    };
    const widthFor = (heights: number[]) => even(Math.min(cap, Math.max(below, LEVEL_ASPECT * typicalHeight(heights))));
    // Wider means taller leaves, which may mean wider again: settle the two together, only ever growing.
    let w = widthFor(heightsAt(below));
    for (let round = 0; round < SETTLE_ROUNDS; round++) {
      const next = widthFor(heightsAt(w));
      if (next <= w) break;
      w = next;
    }
    widths[l] = w;
    rowGaps[l] = even((ROW_GAP * w) / NODE_WIDTH);
    heightsAt(w).forEach((height, i) => {
      const id = ids[i];
      h.set(id, height);
      // A parent taller than its stack for its own label passes the difference down to its last leaf.
      const extra = height - stack[i];
      if (stack[i] === 0 || extra <= 0) return;
      for (let at = kids.get(id)!.at(-1); at !== undefined; at = kids.get(at)!.at(-1)) h.set(at, h.get(at)! + extra);
    });
  }

  // Each level's left edge: the levels before it, each at its width, a gap apart that grows with the narrower.
  const levels: MapLevel[] = [];
  let x = 0;
  for (let l = 0; l < depth; l++) {
    levels.push({ x, width: widths[l], text: textScaleOf(widths[l]), rowGap: rowGaps[l] });
    if (l + 1 < depth) x += widths[l] + even((COLUMN_GAP * widths[l + 1]) / NODE_WIDTH);
  }

  // Places: the roots stacked a root gap apart; each node's children stacked from its top edge.
  const nodes = new Map<string, MapNode>();
  const place = (id: string, y: number) => {
    const l = level.get(id)!;
    const own = kids.get(id)!;
    nodes.set(id, { id, parent: parent.get(id)!, children: own, level: l, x: levels[l].x, y, w: widths[l], h: h.get(id)!, text: levels[l].text });
    let at = y;
    for (const k of own) { place(k, at); at += h.get(k)! + rowGaps[l + 1]; }
  };
  let y = 0;
  for (const r of top) { place(r, y); y += h.get(r)! + rowGaps[0]; }
  const byLevel = byLevelIds.map((ids) => ids.map((id) => nodes.get(id)!).sort((a, b) => a.y - b.y));
  const last = levels.at(-1);
  return {
    view: 'tree',
    nodes,
    roots: top,
    levels,
    byLevel,
    width: last ? last.x + last.width : 0,
    height: Math.max(0, y - rowGaps[0]),
  };
}

const cache = new WeakMap<SpecIndex, Map<string, GraphMap>>();

/** The map of one product (or of a tree no product reaches), from its root: built on first use, then read. */
export function graphMap(index: SpecIndex, root: string): GraphMap {
  let maps = cache.get(index);
  if (!maps) { maps = new Map(); cache.set(index, maps); }
  const known = maps.get(root);
  if (known) return known;
  const map = layoutTree([root], (id) => treeChildren(index, id), (id, centered) => labelHeight(labelFor(index, id, centered)));
  maps.set(root, map);
  return map;
}

type Rect = Pick<MapNode, 'x' | 'y' | 'w' | 'h'>;
type Point = { x: number; y: number };

/** A node's center in the map. */
export const centerOf = (n: Rect) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });

/** A hexagon's chamfer (LA-EXP-DR61): 12 px at the node's content scale, at most a quarter of its width (as the stylesheet draws it). */
export const hexChamfer = (r: Pick<Rect, 'w' | 'h'>) => Math.min(r.w / 4, 12 * contentScale(r.w, r.h));

/**
 * How far in from its box a node's outline is on its left or right side, at a height in it: 0 for
 * a box; for a hexagon, the chamfer at its middle (the point's tip is the box's edge), down to the
 * full chamfer at its top and bottom.
 */
export function outlineInset(r: Rect, shape: 'box' | 'hexagon', y: number): number {
  if (shape === 'box') return 0;
  const half = r.h / 2;
  return hexChamfer(r) * Math.min(1, Math.abs(y - (r.y + half)) / half);
}

/**
 * A parent line (LA-EXP-DR57): level, at the child's middle, from the parent's outline on its
 * right side to the child's outline on its left. A box's outline is its edge; a domain's hexagon
 * (LA-EXP-DR61) is met on its slanted side, and a line into a domain meets the tip of its point.
 */
export function parentLine(parent: Rect, child: Rect, parentShape: 'box' | 'hexagon' = 'box', childShape: 'box' | 'hexagon' = 'box'): [Point, Point] {
  const y = child.y + child.h / 2;
  return [{ x: parent.x + parent.w - outlineInset(parent, parentShape, y), y }, { x: child.x + outlineInset(child, childShape, y), y }];
}

/** A cross-link's ends: each box's middle, on the side that faces the other box (the right side when they overlap). */
export function linkEnds(s: Rect, t: Rect): [Point, Point] {
  const left = t.x + t.w <= s.x;
  return [{ x: left ? s.x : s.x + s.w, y: s.y + s.h / 2 }, { x: left ? t.x + t.w : t.x >= s.x + s.w ? t.x : t.x + t.w, y: t.y + t.h / 2 }];
}
