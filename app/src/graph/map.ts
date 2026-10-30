import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { BORDER, fitsAt, largestFit, linesIn, type MapLabel, type WrappedLabel, textMeasure } from './text';
import { outlineInset, type Shape } from './shapes';
import { treeParent } from './tree';

// The graph's one map per product (LA-EXP-DS05): the product's tree, the nav's (tree.ts), with the
// product as its single root, laid out as one icicle, again only when what it reads changes. Nothing of another product
// is in it: each product is a space of its own. Every node has one place and one size in it,
// whatever is in focus: focusing anything moves the camera (camera.ts), never the map.
//
// One rule sizes every layout, top-down from one fixed product box (LA-EXP-DS06): siblings are the
// same size, with the same text. Each parent splits its room equally among its children, so a busy
// parent packs its children smaller; record counts size nothing.
// - The product's box is MAP_SIZE tall and ROOT_WIDTH of that wide.
// - Siblings split their parent's height equally, a gap apart that is a share of each one's part,
//   their stack filling the parent from its top edge to its bottom edge.
// - Siblings share one width (groupWidth), which follows the height each gets: as wide as their parent, but never
//   wider than MAX_ASPECT times their height, so the more children a parent has, the narrower its
//   children's column, and no box is flatter than MAX_ASPECT to 1. Their column starts a gap after
//   their parent, a share of their width. So one depth level's boxes may sit at different places:
//   each parent's children are a column of their own.
// - Siblings share one text scale: their column's width over TEXT_SIZE, or less when a sibling's
//   whole label (its kind and ID line, and its title wrapped on whole words) would not fit its box
//   at that, the largest at which every sibling's does. Every label is centered.
// - Filters do not change the map: a hidden kind is not drawn, but keeps its place.
//
// Map units are doubles, never rounded, so the deepest boxes keep their places however small they
// are against the product.
//
// Pure and deterministic: the same shape and labels always give the same map. It is laid out in the layout's worker
// (layout.ts), again only when what it reads changes; each box's lines are wrapped when it is first drawn.

/**
 * The product's box in every layout: the Tree map's height, the Nested map's side, in map units.
 * Small enough that the product's title (its text scale times a title's font) stays under the 10,000 px a browser draws a font at.
 */
export const MAP_SIZE = 300_000;
/**
 * A box's text scale is at most its size over this (LA-EXP-DS06): its width (the Tree map, where
 * siblings split their parent's height) or its side (the Nested map). So a box's text is the same
 * share of it at every depth, and a framed box's header reads at about the same size on screen.
 */
export const TEXT_SIZE = 400;
/**
 * The Tree map's own text share: a box's text scale is at most its width over this. Larger than the Nested
 * map's (TEXT_SIZE), so a framed parent's children read at a useful size beside it; that layout keeps
 * TEXT_SIZE, since its headers take room from its children's boxes.
 */
export const TREE_TEXT_SIZE = 250;
/** A Tree box's largest text scale for its width: its width over TREE_TEXT_SIZE. */
export const treeText = (width: number) => width / TREE_TEXT_SIZE;
/** The product's column's width over its height, in the Tree map. */
export const ROOT_WIDTH = 1;
/** The flattest a box may be, its width over its height, in the Tree map: siblings are narrowed to it. */
export const MAX_ASPECT = 6;
/** The widest a column may be, over its parent's width, in the Tree map: so a framed parent's header keeps most of the pane. */
export const MAX_COLUMN_SHARE = 0.4;
/** The height each of `count` siblings gets in a parent `height` tall: an equal part, less their share of the gaps. */
export const partHeight = (height: number, count: number) => (height - ROW_GAP_SHARE * (height / count) * (count - 1)) / count;

/**
 * The width of a group of siblings, each `height` tall, under a parent `parentWidth` wide (LA-EXP-DS06): their
 * parent's width times MAX_COLUMN_SHARE, narrowed to at most MAX_ASPECT times their height. So the more children a parent has, the shorter
 * each is and the narrower their column, and no box is flatter than MAX_ASPECT to 1.
 */
export const groupWidth = (parentWidth: number, height: number) => Math.min(MAX_COLUMN_SHARE * parentWidth, MAX_ASPECT * height);
/** The gap before a column, over its width; the gap between two siblings, over each one's equal part of their parent's height. */
export const COLUMN_GAP_SHARE = 0.15;
export const ROW_GAP_SHARE = 0.1;

/** A box's largest text scale for its size (LA-EXP-DS06): its size over TEXT_SIZE. */
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
  /** Its label's scale (LA-EXP-DS06), shared with its siblings, fixed by the map. */
  text: number;
  /** Its label's lines, wrapped on whole words for its box at its text scale, and whether they are centered in it. */
  lines: WrappedLabel;
  centered: boolean;
}

/** What every layout's map shares (the Tree map here, the Nested map in nested.ts): what the camera, the minimap and the filters read. */
export interface PlacedMap {
  /** Which view it lays out (LA-V93-R21). */
  view: 'tree' | 'nested';
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
}

/** The root of the map that holds a node: its product, or the top of its tree when no product reaches it. */
export function mapRootOf(index: RecordIndex, id: string): string {
  let at = id;
  const seen = new Set([at]);
  for (let up = treeParent(index, at); up !== null && !seen.has(up); up = treeParent(index, up)) { seen.add(up); at = up; }
  return at;
}

/**
 * A tree's shape before it is laid out: every node in the walk's order from the roots (a parent before its children, a
 * node reached twice keeping its first place), with its parent, its children and its depth. The layout's geometry
 * (TreeGeometry) lists the nodes in this order, so the shape on one thread and the geometry from another fit together.
 */
export interface TreeShape {
  roots: readonly string[];
  ids: readonly string[];
  /** Each node's parent's place in `ids`, -1 for a root. */
  parents: Int32Array;
  levels: Int32Array;
  /** Each node's children, by their places in `ids`. */
  children: readonly (readonly number[])[];
}

/** A tree's shape from its roots and a children function (exported for the layout's worker and tests). */
export function treeShape(roots: readonly string[], childrenOf: (id: string) => readonly string[]): TreeShape {
  const at = new Map<string, number>();
  const ids: string[] = [];
  const parents: number[] = [];
  const levels: number[] = [];
  const children: number[][] = [];
  const visit = (id: string, up: number, l: number) => {
    const i = ids.length;
    at.set(id, i);
    ids.push(id);
    parents.push(up);
    levels.push(l);
    const own: number[] = [];
    children.push(own);
    for (const c of childrenOf(id)) {
      if (at.has(c)) continue;
      own.push(ids.length);
      visit(c, i, l + 1);
    }
  };
  const top: string[] = [];
  for (const r of roots) { if (!at.has(r)) { top.push(r); visit(r, -1, 0); } }
  return { roots: top, ids, parents: Int32Array.from(parents), levels: Int32Array.from(levels), children };
}

/** Each node's box and text scale, in its shape's order: x, y, w, h and text, five numbers a node. */
export interface TreeGeometry { boxes: Float64Array; width: number; height: number }

/**
 * A label's largest fit in a box one unit wide and `aspect` tall, at most `most`, kept per label and aspect: a box k times
 * as large fits it at k times the scale (its border grows with its text), and boxes narrowed to MAX_ASPECT share one
 * aspect, so a record repeated in many places, or many alike, is fitted once. A fit cut at its `most` is kept as what it
 * fits at least. One cache serves every layout made with one text measure (its key in the cache's): the layout's
 * worker keeps it from one layout to the next, so a new layout fits again only the labels and boxes that changed.
 */
export interface FitCache { measure: string; fits: Map<string, { at: number; exact: boolean }> }
export const fitCache = (): FitCache => ({ measure: textMeasure().key, fits: new Map() });

/**
 * Lays out a tree's shape as an icicle (LA-EXP-DS06), each node's label given by `labelOf` (by its place in the shape):
 * pure, the same shape and labels always giving the same geometry.
 */
export function placeTree(shape: TreeShape, labelOf: (i: number) => MapLabel, cache: FitCache = fitCache()): TreeGeometry {
  if (cache.measure !== textMeasure().key) { cache.fits.clear(); cache.measure = textMeasure().key; }
  const boxes = new Float64Array(shape.ids.length * 5);
  let right = 0;
  const unitFit = (label: MapLabel, aspect: number, most: number) => {
    const key = `${aspect}\u0000${label.shape ?? ''}\u0000${label.marks ?? 0}\u0000${label.meta}\u0000${label.title}`;
    const known = cache.fits.get(key);
    if (known && (known.exact || known.at >= most)) return Math.min(known.at, most);
    const at = largestFit(label, true, 1, aspect, most, (s) => BORDER * s);
    cache.fits.set(key, { at, exact: at < most });
    return at;
  };
  /** Places siblings `h` tall each, a gap apart, in a column of their own after `after` (their parent's right edge), under a parent `parentWidth` wide. */
  const place = (ids: readonly number[], after: number, parentWidth: number, y0: number, h: number, gap: number, root: boolean) => {
    const w = root ? parentWidth : groupWidth(parentWidth, h);
    const x = root ? after : after + COLUMN_GAP_SHARE * w;
    right = Math.max(right, x + w);
    // Its border grows with its text (LA-EXP-DS06).
    const border = (s: number) => BORDER * s;
    const labels = ids.map((i) => labelOf(i));
    // The smallest of the siblings' largest fits, at most their width's share: each sibling's fit capped at the smallest so
    // far, which a sibling that fits there answers at once. Scaled from one unit wide, it is settled just under itself
    // where rounding would wrap a sibling's label one more line.
    let text = Math.min(treeText(w), w * labels.reduce((most, label) => unitFit(label, h / w, most), treeText(w) / w));
    for (let step = 1e-12; text > 0 && step < 1e-3 && !labels.every((label) => fitsAt(label, true, w, h, text, border)); step *= 16) text *= 1 - step;
    ids.forEach((i, k) => {
      const y = y0 + k * (h + gap);
      boxes.set([x, y, w, h, text], i * 5);
      const own = shape.children[i];
      if (own.length === 0) return;
      place(own, x + w, w, y, partHeight(h, own.length), ROW_GAP_SHARE * (h / own.length), false);
    });
  };
  const tops = shape.roots.map((r) => shape.ids.indexOf(r));
  if (tops.length > 0) place(tops, 0, MAP_SIZE * ROOT_WIDTH, 0, MAP_SIZE, ROW_GAP_SHARE * MAP_SIZE, true);
  return { boxes, width: right, height: tops.length === 0 ? 0 : tops.length * MAP_SIZE + (tops.length - 1) * ROW_GAP_SHARE * MAP_SIZE };
}

/**
 * A Tree map's node: its box, its text scale and its label's lines, wrapped on whole words for its box at its scale when
 * first read (only a drawn box's are), with the same measure the layout fitted them with.
 */
class TreeNode implements MapNode {
  private wrapped: WrappedLabel | null = null;
  readonly centered = true;
  constructor(
    readonly id: string, readonly parent: string | null, readonly children: readonly string[], readonly level: number,
    readonly x: number, readonly y: number, readonly w: number, readonly h: number, readonly text: number, private readonly label: MapLabel,
  ) {}
  get lines(): WrappedLabel {
    return (this.wrapped ??= linesIn(this.label, this.text > 0 ? (this.w - 2 * BORDER * this.text) / this.text : Infinity, true));
  }
}

/** A Tree map from a tree's shape, its labels and its geometry (placeTree's, here or in the layout's worker). */
export function assembleTree(shape: TreeShape, labelOf: (i: number) => MapLabel, geometry: TreeGeometry): GraphMap {
  const nodes = new Map<string, MapNode>();
  const byLevelNodes: MapNode[][] = [];
  const { ids } = shape;
  const { boxes } = geometry;
  ids.forEach((id, i) => {
    const up = shape.parents[i];
    const b = i * 5;
    const node = new TreeNode(id, up < 0 ? null : ids[up], shape.children[i].map((c) => ids[c]), shape.levels[i], boxes[b], boxes[b + 1], boxes[b + 2], boxes[b + 3], boxes[b + 4], labelOf(i));
    nodes.set(id, node);
    (byLevelNodes[node.level] ??= []).push(node);
  });
  return { view: 'tree', nodes, roots: shape.roots, byLevel: byLevelNodes.map((level) => level.sort((a, b) => a.y - b.y)), width: geometry.width, height: geometry.height };
}

type Rect = Pick<MapNode, 'x' | 'y' | 'w' | 'h'>;
/** A box with its text scale, which its border and outline grow by (LA-EXP-DS06). */
type Scaled = Rect & Pick<MapNode, 'text'>;
type Point = { x: number; y: number };

/**
 * A parent line (LA-EXP-DS05): level, at the child's middle, from the parent's outline on its
 * right side to the child's outline on its left (LA-V93-R06). A box's outline is its edge; a
 * shape's is where its edge crosses that height, so a line into a domain's hexagon meets the tip
 * of its point and a line out of one starts on its slanted side.
 */
export function parentLine(parent: Scaled, child: Scaled, parentShape: Shape = 'box', childShape: Shape = 'box'): [Point, Point] {
  const y = child.y + child.h / 2;
  return [
    { x: parent.x + parent.w - outlineInset(parent, parentShape, parent.text, y, 'right'), y },
    { x: child.x + outlineInset(child, childShape, child.text, y, 'left'), y },
  ];
}
