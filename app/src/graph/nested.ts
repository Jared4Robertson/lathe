import { MAP_SIZE, nestedLeafText, nestedText, sizeText, type MapNode, type PlacedMap, type TreeGeometry, type TreeShape } from './map';
import { BORDER, labelHeight, largestFit, linesIn, type MapLabel, type WrappedLabel } from './text';

// The graph's Nested map (LA-EXP-DS07): the same tree as the Tree map (map.ts), one product's, the
// product its single root, drawn as nested squares. A product is made of its stages and domains, a domain of
// its stages, a stage of its folders, a folder of its records, a record of its children:
// each box holds its children rather than linking to them. Laid out like the Tree map, off the
// main thread and again only when what it reads changes (layout.ts), and never changed by the focus: focusing moves the camera (camera.ts).
//
// The one rule (LA-EXP-DS06), top-down from the product's square, MAP_SIZE across: siblings are
// the same size, with the same text.
// - A parent's room under its header band, inside its padding, holds its children as a grid of
//   equal squares in the tree's order, row by row, a gap apart, with the column count that makes
//   the squares largest. Room the grid leaves is blank: a busy parent packs its children smaller.
// - Siblings share two text scales, each worked out over every sibling's label whatever it holds now:
//   as leaves, their side over NESTED_LEAF_TEXT_SIZE (a title at most a tenth of the side), or the largest
//   below it at which every sibling's whole label fits centered in its square; as parents, their side
//   over NESTED_TEXT_SIZE, or the largest below it at which every sibling's label fits a header band at
//   most HEADER_SHARE of its square. A sibling draws its label at the one it is now, a leaf's or a parent's.
// - Siblings share one header band too, as tall as the tallest of their labels at that scale, every
//   sibling's counted, a leaf's too: what a sibling holds sizes nothing of the others (LA-PAT-APP-UX-R22).
// - The padding and the gaps are shares of the box's side, so the layout is the same at any size.
// Record counts and titles size nothing.
//
// Pure and deterministic: the same tree always gives the same map.

/** The padding inside a box around its children, and the gap between two siblings, at its side's text scale (its side over TEXT_SIZE). */
export const NEST_PAD = 8;
export const NEST_GAP = 6;
/** The most of its square a parent's header band takes. */
export const HEADER_SHARE = 0.3;

export interface NestedNode extends MapNode {
  /** The header band's height, in map units, its siblings' tallest label at their text scale (every sibling's, a leaf's too): 0 for a box with no children (its label is centered in it). */
  header: number;
  /** Its place in the tree's order, a parent before its children: the keyboard's order. */
  order: number;
}

export interface NestedMap extends PlacedMap {
  view: 'nested';
  nodes: ReadonlyMap<string, NestedNode>;
}

/**
 * The grid of `n` equal squares, a gap apart, that fills a room `w` by `h` best (exported for
 * tests): the column count whose squares are largest (the fewest columns among equals), each
 * square's side, and its rows.
 */
export function gridOf(n: number, w: number, h: number, gap: number): { side: number; columns: number; rows: number } {
  let best = { side: 0, columns: 1, rows: n };
  for (let columns = 1; columns <= n; columns++) {
    const rows = Math.ceil(n / columns);
    const side = Math.min((w - (columns - 1) * gap) / columns, (h - (rows - 1) * gap) / rows);
    if (side > best.side) best = { side, columns, rows };
  }
  return best;
}

/**
 * Lays out a tree's shape as nested squares (LA-EXP-DS07), each node's label given by `labelOf` (by its place in the
 * shape): pure, the same shape and labels always giving the same geometry. Each node's five numbers are its x, y, side,
 * text scale and header band.
 */
export function placeNested(shape: TreeShape, labelOf: (i: number) => MapLabel): TreeGeometry {
  const boxes = new Float64Array(shape.ids.length * 5);
  /** Some siblings, each a square `side` across at its place: their shared text and header band, then each one's children inside it. */
  const place = (ids: readonly number[], side: number, at: readonly { x: number; y: number }[]) => {
    const unit = sizeText(side);
    const border = (s: number) => BORDER * Math.max(0.5, s);
    const labels = ids.map((i) => labelOf(i));
    const leaf = ids.map((i) => shape.children[i].length === 0);
    // Both scales fitted over every sibling, a leaf or a parent now, so a sibling gaining its first child or losing its
    // last changes neither its siblings' text nor their header band (LA-PAT-APP-UX-R22): every label must fit a header
    // band at the parents' scale and the whole square at the leaves'.
    const text = labels.reduce((t, label) => Math.min(t, largestFit(label, false, side, HEADER_SHARE * side, t, border)), nestedText(side));
    const leafText = labels.reduce((t, label) => Math.min(t, largestFit(label, false, side, side, t, border)), nestedLeafText(side));
    const header = Math.max(0, ...labels.map((label) => text * labelHeight(linesIn(label, text > 0 ? (side - 2 * border(text)) / text : Infinity, false))));
    const pad = NEST_PAD * unit;
    const gap = NEST_GAP * unit;
    ids.forEach((i, k) => {
      const { x, y } = at[k];
      boxes.set([x, y, side, leaf[k] ? leafText : text, leaf[k] ? 0 : header], i * 5);
      if (leaf[k]) return;
      const own = shape.children[i];
      const below = Math.max(header, pad);
      const grid = gridOf(own.length, side - 2 * pad, side - below - pad, gap);
      place(own, grid.side, own.map((_, n) => ({ x: x + pad + (n % grid.columns) * (grid.side + gap), y: y + below + Math.floor(n / grid.columns) * (grid.side + gap) })));
    });
  };
  // The roots, each the product's square, in a grid a wide gap apart.
  const top = shape.roots.map((r) => shape.ids.indexOf(r));
  const rootGap = NEST_GAP * 4 * sizeText(MAP_SIZE);
  const columns = Math.ceil(Math.sqrt(top.length));
  const rows = Math.ceil(top.length / Math.max(1, columns));
  place(top, MAP_SIZE, top.map((_, k) => ({ x: (k % columns) * (MAP_SIZE + rootGap), y: Math.floor(k / columns) * (MAP_SIZE + rootGap) })));
  return {
    boxes,
    width: top.length === 0 ? 0 : Math.min(columns, top.length) * (MAP_SIZE + rootGap) - rootGap,
    height: top.length === 0 ? 0 : rows * (MAP_SIZE + rootGap) - rootGap,
  };
}

/** A Nested map's node: its lines wrapped for its box at its scale when first read (only a drawn box's are). */
class NestNode implements NestedNode {
  private wrapped: WrappedLabel | null = null;
  constructor(
    readonly id: string, readonly parent: string | null, readonly children: readonly string[], readonly level: number, readonly order: number,
    readonly x: number, readonly y: number, readonly w: number, readonly h: number, readonly text: number, readonly header: number, private readonly label: MapLabel,
  ) {}
  /** A Nested box is a rectangle: its label is set at its left, a leaf's in its square's middle, a parent's in its header band (text.ts centeredLabel). */
  readonly centered = false;
  get lines(): WrappedLabel {
    const border = BORDER * Math.max(0.5, this.text);
    return (this.wrapped ??= linesIn(this.label, this.text > 0 ? (this.w - 2 * border) / this.text : Infinity, false));
  }
}

/** A Nested map from a tree's shape, its labels and its geometry (placeNested's, here or in the layout's worker). */
export function assembleNested(shape: TreeShape, labelOf: (i: number) => MapLabel, geometry: TreeGeometry): NestedMap {
  const nodes = new Map<string, NestedNode>();
  const byLevel: NestedNode[][] = [];
  const { ids } = shape;
  const { boxes } = geometry;
  ids.forEach((id, i) => {
    const up = shape.parents[i];
    const b = i * 5;
    const node = new NestNode(id, up < 0 ? null : ids[up], shape.children[i].map((c) => ids[c]), shape.levels[i], i, boxes[b], boxes[b + 1], boxes[b + 2], boxes[b + 2], boxes[b + 3], boxes[b + 4], labelOf(i));
    nodes.set(id, node);
    (byLevel[node.level] ??= []).push(node);
  });
  return { view: 'nested', nodes, roots: shape.roots, byLevel, width: geometry.width, height: geometry.height };
}
