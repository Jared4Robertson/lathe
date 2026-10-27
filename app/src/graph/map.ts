import type { SpecIndex } from '../specs/data';
import { contentScale } from './layout';
import { BORDER, largestFit, linesIn, treeLabel, type MapLabel, type WrappedLabel } from './text';
import { outlineInset, type Shape } from './shapes';
import { treeChildren, treeParent } from './tree';

// The graph's one map per product (LA-EXP-DR57): the product's tree, the nav's (tree.ts), with the
// product as its single root, laid out once per spec load as one icicle. Nothing of another product
// is in it: each product is a space of its own. Every node has one place and one size in it,
// whatever is in focus: focusing anything moves the camera (camera.ts), never the map.
//
// One rule sizes every layout, top-down from one fixed product box (LA-EXP-DR58): siblings are the
// same size, with the same text. Each parent splits its room equally among its children, so a busy
// parent packs its children smaller; record counts size nothing.
// - The product's box is MAP_SIZE tall and ROOT_WIDTH of that wide.
// - Siblings split their parent's height equally, a gap apart that is a share of each one's part,
//   their stack filling the parent from its top edge to its bottom edge.
// - Every box in one depth column has the same width: each column COLUMN_RATIO of the one before,
//   a gap before it that is a share of its width, so the widths are fixed fractions of the map.
// - Siblings share one text scale: their column's width over TEXT_SIZE, or less when a sibling's
//   whole label (its kind and ID line, and its title wrapped on whole words) would not fit its box
//   at that, the largest at which every sibling's does. Every label is centered.
// - Filters do not change the map: a hidden kind is not drawn, but keeps its place.
//
// Map units are doubles, never rounded, so the deepest boxes keep their places however small they
// are against the product.
//
// Pure and deterministic: the same index always gives the same map, and it is built once per index.

/** The product's box in every layout: the Tree map's height, the Nested map's side, the Voronoi hexagon's width, in map units. */
export const MAP_SIZE = 500_000;
/**
 * A box's text scale is at most its size over this (LA-EXP-DR58): its width (the Tree map, where
 * siblings split their parent's height), its side (the Nested map) or the square root of its area
 * (the Voronoi map). So a box's text is the same share of it at every depth, and a framed box's
 * header reads at about the same size on screen.
 */
export const TEXT_SIZE = 400;
/** The product's column's width over its height, in the Tree map. */
export const ROOT_WIDTH = 1;
/** Each depth column's width over the one before it, in the Tree map. */
export const COLUMN_RATIO = 0.4;
/** The gap before a column, over its width; the gap between two siblings, over each one's equal part of their parent's height. */
export const COLUMN_GAP_SHARE = 0.15;
export const ROW_GAP_SHARE = 0.1;

/** A box's largest text scale for its size (LA-EXP-DR58): its size over TEXT_SIZE. */
export const sizeText = (size: number) => size / TEXT_SIZE;

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
  /** Its label's scale (LA-EXP-DR58), shared with its siblings, fixed by the map. */
  text: number;
  /** Its label's lines, wrapped on whole words for its box at its text scale, and whether they are centered in it. */
  lines: WrappedLabel;
  centered: boolean;
}

export interface MapLevel {
  /** Its left edge and its width, shared by every node in it: a fixed fraction of the map's. */
  x: number;
  width: number;
}

/** What every layout's map shares (the Tree map here, the Nested and Voronoi maps in nested.ts and voronoi.ts): what the camera, the minimap and the filters read. */
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

/** The root of the map that holds a node: its product, or the top of its tree when no product reaches it. */
export function mapRootOf(index: SpecIndex, id: string): string {
  let at = id;
  const seen = new Set([at]);
  for (let up = treeParent(index, at); up !== null && !seen.has(up); up = treeParent(index, up)) { seen.add(up); at = up; }
  return at;
}

/**
 * Lays out a tree given by its roots, a children function and, for each node, its label (its ID
 * when not given) as an icicle (exported for tests).
 */
export function layoutTree(roots: readonly string[], childrenOf: (id: string) => readonly string[], labelOf: (id: string) => MapLabel = (id) => ({ title: id, meta: '' })): GraphMap {
  // Levels, by a walk from the roots; a node reached twice keeps its first place.
  const parent = new Map<string, string | null>();
  const level = new Map<string, number>();
  const kids = new Map<string, string[]>();
  let depth = 0;
  const visit = (id: string, up: string | null, l: number) => {
    parent.set(id, up);
    level.set(id, l);
    depth = Math.max(depth, l + 1);
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

  // Each column's left edge and width: fixed fractions of the product's box, a gap before each.
  const levels: MapLevel[] = [];
  for (let l = 0, x = 0; l < depth; l++) {
    const width = MAP_SIZE * ROOT_WIDTH * COLUMN_RATIO ** l;
    if (l > 0) x += COLUMN_GAP_SHARE * width;
    levels.push({ x, width });
    x += width;
  }

  // From the roots down: each group of siblings an equal part of its parent's height, sharing one text scale.
  const nodes = new Map<string, MapNode>();
  const byLevelIds: string[][] = [];
  const place = (ids: readonly string[], l: number, y0: number, h: number, gap: number, up: string | null) => {
    const { x, width: w } = levels[l];
    const border = BORDER * contentScale(w, h);
    const labels = ids.map((id) => labelOf(id));
    const text = Math.min(...labels.map((label) => largestFit(label, true, w, h, sizeText(w), border)));
    ids.forEach((id, i) => {
      const y = y0 + i * (h + gap);
      const own = kids.get(id)!;
      const lines = linesIn(labels[i], text > 0 ? (w - 2 * border) / text : Infinity, true);
      nodes.set(id, { id, parent: up, children: own, level: l, x, y, w, h, text, lines, centered: true });
      (byLevelIds[l] ??= []).push(id);
      if (own.length === 0) return;
      const part = h / own.length;
      const between = ROW_GAP_SHARE * part;
      place(own, l + 1, y, (h - between * (own.length - 1)) / own.length, between, id);
    });
  };
  if (top.length > 0) place(top, 0, 0, MAP_SIZE, ROW_GAP_SHARE * MAP_SIZE, null);

  const byLevel = byLevelIds.map((ids) => ids.map((id) => nodes.get(id)!).sort((a, b) => a.y - b.y));
  const last = levels.at(-1);
  return {
    view: 'tree',
    nodes,
    roots: top,
    levels,
    byLevel,
    width: last ? last.x + last.width : 0,
    height: top.length === 0 ? 0 : top.length * MAP_SIZE + (top.length - 1) * ROW_GAP_SHARE * MAP_SIZE,
  };
}

const cache = new WeakMap<SpecIndex, Map<string, GraphMap>>();

/** The map of one product (or of a tree no product reaches), from its root: built on first use, then read. */
export function graphMap(index: SpecIndex, root: string): GraphMap {
  let maps = cache.get(index);
  if (!maps) { maps = new Map(); cache.set(index, maps); }
  const known = maps.get(root);
  if (known) return known;
  const map = layoutTree([root], (id) => treeChildren(index, id), (id) => treeLabel(index, id));
  maps.set(root, map);
  return map;
}

type Rect = Pick<MapNode, 'x' | 'y' | 'w' | 'h'>;
type Point = { x: number; y: number };

/** A node's center in the map. */
export const centerOf = (n: Rect) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });

/**
 * A parent line (LA-EXP-DR57): level, at the child's middle, from the parent's outline on its
 * right side to the child's outline on its left (LA-EXP-DR65). A box's outline is its edge; a
 * shape's is where its edge crosses that height, so a line into a domain's hexagon meets the tip
 * of its point and a line out of one starts on its slanted side.
 */
export function parentLine(parent: Rect, child: Rect, parentShape: Shape = 'box', childShape: Shape = 'box'): [Point, Point] {
  const y = child.y + child.h / 2;
  return [
    { x: parent.x + parent.w - outlineInset(parent, parentShape, contentScale(parent.w, parent.h), y, 'right'), y },
    { x: child.x + outlineInset(child, childShape, contentScale(child.w, child.h), y, 'left'), y },
  ];
}

/** A cross-link's ends: each box's middle, on the side that faces the other box (the right side when they overlap). */
export function linkEnds(s: Rect, t: Rect): [Point, Point] {
  const left = t.x + t.w <= s.x;
  return [{ x: left ? s.x : s.x + s.w, y: s.y + s.h / 2 }, { x: left ? t.x + t.w : t.x >= s.x + s.w ? t.x : t.x + t.w, y: t.y + t.h / 2 }];
}
