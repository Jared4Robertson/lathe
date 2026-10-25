import type { SpecIndex } from '../specs/data';
import { contentScale, NODE_HEIGHT, NODE_WIDTH } from './layout';
import { hasMarks, labelLines, labelWidth, textScaleOf } from './text';
import { treeChildren, treeOf } from './tree';

// The graph's one map (LA-EXP-DR57): the whole tree, the nav's (tree.ts), laid out once per spec
// load as one icicle. Every node has one place and one size in it, whatever is in focus: focusing
// anything moves the camera (camera.ts), never the map.
//
// - A leaf is NODE_WIDTH by NODE_HEIGHT. A parent is exactly as tall as its children stacked, the
//   gaps between them included, and their stack starts at its top edge.
// - Every node in one level (its depth in the tree, a product at 0) has the same width
//   (LA-EXP-DR58), the larger of two:
//   - its proportional width: shrinking toward the leaves in proportion to the level's typical height
//     (its median by height: the height of the node a point of the level most likely lies in), never
//     narrower than the proportional width below it nor more than MAX_LEVEL_STEP times as wide, and
//     the product's level no more than MAX_ROOT_STEP times, so it stays usable;
//   - the widest label in it on one line, at each box's text scale (text.ts), so no title is cut off.
//   The gap between two siblings, and between two levels, grows with the proportional width, so the
//   map reads the same at every zoom and a parent's height never depends on its children's titles.
// - Each node's text scale is fixed here, by its height (text.ts): the camera never changes it.
// - Filters do not change the map: a hidden kind is not drawn, but keeps its place.
//
// Pure and deterministic: the same index always gives the same map, and it is built once per index.

/** How wide a level is for its typical height: the width over the height. */
export const LEVEL_ASPECT = 1;
/** The most one level is wider than the level below it (LA-EXP-DR58). */
export const MAX_LEVEL_STEP = 3;
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
  /** Its label's scale (LA-EXP-DR58): its height over a leaf's, fixed by the map. */
  text: number;
}

export interface MapLevel {
  /** Its left edge and its width, shared by every node in it: its proportional width, or its widest label if wider. */
  x: number;
  width: number;
  /** Its width in proportion to its typical height, within the caps; its gaps grow with it. */
  proportional: number;
  /** The gap between two siblings in it. */
  rowGap: number;
}

/** What both views' maps share (the Tree map here, the Nested map in nested.ts): what the camera, the minimap and the filters read. */
export interface PlacedMap {
  /** Which view it lays out (LA-EXP-UC03-R16). */
  view: 'tree' | 'nested';
  nodes: ReadonlyMap<string, MapNode>;
  /** The roots: the products, then any record no product reaches. */
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
/** Even, so a box's middle is a whole pixel. */
const even = (n: number) => 2 * Math.round(n / 2);

/** The roots of the tree: the products, then each record or group no product reaches, in the workspace's order. Both views' maps start from them. */
export function rootsOf(index: SpecIndex): string[] {
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

/**
 * Lays out a tree given by its roots, a children function and, for each node, how wide its label is
 * on one line at text scale 1 (exported for tests; a leaf's width when not given).
 */
export function layoutTree(roots: readonly string[], childrenOf: (id: string) => readonly string[], labelWidthOf: (id: string) => number = () => NODE_WIDTH): GraphMap {
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
  /** Each level's proportional width, which sets its gaps; its width is that or its widest label. */
  const proportional: number[] = new Array(depth).fill(NODE_WIDTH);
  const widths: number[] = new Array(depth).fill(NODE_WIDTH);
  const rowGaps: number[] = new Array(depth).fill(ROW_GAP);
  for (let l = depth - 1; l >= 0; l--) {
    let widest = 0;
    for (const id of byLevelIds[l]) {
      const own = kids.get(id)!;
      const height = own.length === 0 ? NODE_HEIGHT : own.reduce((sum, k) => sum + h.get(k)!, 0) + rowGaps[l + 1] * (own.length - 1);
      h.set(id, height);
      widest = Math.max(widest, textScaleOf(height) * labelWidthOf(id));
    }
    const wanted = LEVEL_ASPECT * typicalHeight(byLevelIds[l].map((id) => h.get(id)!));
    const below = l + 1 < depth ? proportional[l + 1] : NODE_WIDTH;
    proportional[l] = even(Math.min((l === 0 ? MAX_ROOT_STEP : MAX_LEVEL_STEP) * below, Math.max(below, wanted)));
    widths[l] = Math.max(proportional[l], 2 * Math.ceil(widest / 2));
    rowGaps[l] = even((ROW_GAP * proportional[l]) / NODE_WIDTH);
  }

  // Each level's left edge: the levels before it, each at its width, a gap apart that grows with the narrower.
  const levels: MapLevel[] = [];
  let x = 0;
  for (let l = 0; l < depth; l++) {
    levels.push({ x, width: widths[l], proportional: proportional[l], rowGap: rowGaps[l] });
    if (l + 1 < depth) x += widths[l] + even((COLUMN_GAP * proportional[l + 1]) / NODE_WIDTH);
  }

  // Places: the roots stacked a root gap apart; each node's children stacked from its top edge.
  const nodes = new Map<string, MapNode>();
  const place = (id: string, y: number) => {
    const l = level.get(id)!;
    const own = kids.get(id)!;
    nodes.set(id, { id, parent: parent.get(id)!, children: own, level: l, x: levels[l].x, y, w: widths[l], h: h.get(id)!, text: textScaleOf(h.get(id)!) });
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

const cache = new WeakMap<SpecIndex, GraphMap>();

/** The one map of an index: built on first use, then read. */
export function graphMap(index: SpecIndex): GraphMap {
  const known = cache.get(index);
  if (known) return known;
  const map = layoutTree(rootsOf(index), (id) => treeChildren(index, id), (id) => labelWidth(labelLines(index, id), { hexagon: index.byId.get(id)?.kind === 'domain', marked: hasMarks(index, id) }));
  cache.set(index, map);
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
