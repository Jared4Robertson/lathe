import type { SpecIndex } from '../specs/data';
import { NODE_HEIGHT, NODE_WIDTH } from './layout';
import { treeChildren, treeOf } from './tree';

// The graph's one map (LA-BRW-DR390): the whole tree, the nav's (tree.ts), laid out once per spec
// load as one icicle. Every node has one place and one size in it, whatever is in focus: focusing
// anything moves the camera (camera.ts), never the map.
//
// - A leaf is NODE_WIDTH by NODE_HEIGHT. A parent is exactly as tall as its children stacked, the
//   gaps between them included, and their stack starts at its top edge.
// - Every node in one level (its depth in the tree, a product at 0) has the same width
//   (LA-BRW-DR391). Widths shrink toward the leaves in proportion to the level's typical height (its
//   median by height: the height of the node a point of the level most likely lies in), but a level
//   is never narrower than the one below it nor more than MAX_LEVEL_STEP times as wide, and the
//   product's level no more than MAX_ROOT_STEP times, so it stays usable. The gap between two siblings, and between two
//   levels, grows with the level's width, so the map reads the same at every zoom.
// - Filters do not change the map: a hidden kind is not drawn, but keeps its place.
//
// Pure and deterministic: the same index always gives the same map, and it is built once per index.

/** How wide a level is for its typical height: the width over the height. */
export const LEVEL_ASPECT = 1;
/** The most one level is wider than the level below it (LA-BRW-DR391). */
export const MAX_LEVEL_STEP = 4;
/** The most the roots' level (the products) is wider than the level below it, so a product's picture leaves room for its domains. */
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
}

export interface MapLevel {
  /** Its left edge and its width, shared by every node in it. */
  x: number;
  width: number;
  /** The gap between two siblings in it. */
  rowGap: number;
}

export interface GraphMap {
  nodes: ReadonlyMap<string, MapNode>;
  /** The roots, top to bottom: the products, then any record no product reaches. */
  roots: readonly string[];
  levels: readonly MapLevel[];
  /** The nodes of each level, top to bottom. */
  byLevel: readonly (readonly MapNode[])[];
  /** The whole map's size; it starts at (0, 0). */
  width: number;
  height: number;
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
/** Even, so a box's middle is a whole pixel. */
const even = (n: number) => 2 * Math.round(n / 2);

/** The roots of the tree: the products, then each record or group no product reaches, in the workspace's order. */
function rootsOf(index: SpecIndex): string[] {
  const tree = treeOf(index);
  const roots = index.products.map((p) => p.id);
  const seen = new Set(roots);
  for (const r of index.workspace.records) {
    if (seen.has(r.id) || tree.parent.has(r.id)) continue;
    seen.add(r.id);
    roots.push(r.id);
  }
  return roots;
}

/** Lays out a tree given by its roots and a children function (exported for tests). */
export function layoutTree(roots: readonly string[], childrenOf: (id: string) => readonly string[]): GraphMap {
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
  for (let l = depth - 1; l >= 0; l--) {
    for (const id of byLevelIds[l]) {
      const own = kids.get(id)!;
      h.set(id, own.length === 0 ? NODE_HEIGHT : own.reduce((sum, k) => sum + h.get(k)!, 0) + rowGaps[l + 1] * (own.length - 1));
    }
    const wanted = LEVEL_ASPECT * typicalHeight(byLevelIds[l].map((id) => h.get(id)!));
    const below = l + 1 < depth ? widths[l + 1] : NODE_WIDTH;
    widths[l] = even(Math.min((l === 0 ? MAX_ROOT_STEP : MAX_LEVEL_STEP) * below, Math.max(below, wanted)));
    rowGaps[l] = even((ROW_GAP * widths[l]) / NODE_WIDTH);
  }

  // Each level's left edge: the levels before it, each at its width, a gap apart that grows with the narrower.
  const levels: MapLevel[] = [];
  let x = 0;
  for (let l = 0; l < depth; l++) {
    levels.push({ x, width: widths[l], rowGap: rowGaps[l] });
    if (l + 1 < depth) x += widths[l] + even((COLUMN_GAP * widths[l + 1]) / NODE_WIDTH);
  }

  // Places: the roots stacked a root gap apart; each node's children stacked from its top edge.
  const nodes = new Map<string, MapNode>();
  const place = (id: string, y: number) => {
    const l = level.get(id)!;
    const own = kids.get(id)!;
    nodes.set(id, { id, parent: parent.get(id)!, children: own, level: l, x: levels[l].x, y, w: widths[l], h: h.get(id)! });
    let at = y;
    for (const k of own) { place(k, at); at += h.get(k)! + rowGaps[l + 1]; }
  };
  let y = 0;
  for (const r of top) { place(r, y); y += h.get(r)! + rowGaps[0]; }
  const byLevel = byLevelIds.map((ids) => ids.map((id) => nodes.get(id)!).sort((a, b) => a.y - b.y));
  const last = levels.at(-1);
  return {
    nodes,
    roots: top,
    levels,
    byLevel,
    width: last ? last.x + last.width : 0,
    height: Math.max(0, y - rowGaps[0]),
  };
}

const cache = new WeakMap<SpecIndex, GraphMap>();

/** The one map of an index: built on first use, then read. */
export function graphMap(index: SpecIndex): GraphMap {
  const known = cache.get(index);
  if (known) return known;
  const map = layoutTree(rootsOf(index), (id) => treeChildren(index, id));
  cache.set(index, map);
  return map;
}

type Rect = Pick<MapNode, 'x' | 'y' | 'w' | 'h'>;
type Point = { x: number; y: number };

/** A node's center in the map. */
export const centerOf = (n: Rect) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });

/** A parent line (LA-BRW-DR390): level, from the parent's right edge to the child's left edge, at the child's middle. */
export const parentLine = (parent: Rect, child: Rect): [Point, Point] => [{ x: parent.x + parent.w, y: child.y + child.h / 2 }, { x: child.x, y: child.y + child.h / 2 }];

/** A cross-link's ends: each box's middle, on the side that faces the other box (the right side when they overlap). */
export function linkEnds(s: Rect, t: Rect): [Point, Point] {
  const left = t.x + t.w <= s.x;
  return [{ x: left ? s.x : s.x + s.w, y: s.y + s.h / 2 }, { x: left ? t.x + t.w : t.x >= s.x + s.w ? t.x : t.x + t.w, y: t.y + t.h / 2 }];
}
