import type { SpecIndex } from '../specs/data';
import { MAP_SIZE, sizeText, type MapNode, type PlacedMap } from './map';
import { BORDER, labelHeight, largestFit, linesIn, mapLabel, type MapLabel, textMeasure } from './text';
import { treeChildren } from './tree';

// The graph's Nested map (LA-EXP-DS07): the same tree as the Tree map (map.ts), one product's, the
// product its single root, drawn as nested squares. A product is made of its stages and domains, a domain of
// its stages, a stage of its folders, a folder of its records, a record of its children:
// each box holds its children rather than linking to them. Laid out once per spec load, like the
// Tree map, and never changed by the focus: focusing moves the camera (camera.ts).
//
// The one rule (LA-EXP-DS06), top-down from the product's square, MAP_SIZE across: siblings are
// the same size, with the same text.
// - A parent's room under its header band, inside its padding, holds its children as a grid of
//   equal squares in the tree's order, row by row, a gap apart, with the column count that makes
//   the squares largest. Room the grid leaves is blank: a busy parent packs its children smaller.
// - Siblings share one text scale: their side over TEXT_SIZE, or the largest below it at which
//   every sibling's whole label fits, a leaf's centered in its square, a parent's in a header band
//   at most HEADER_SHARE of its square.
// - Siblings share one header band too, as tall as the tallest of their labels at that scale.
// - The padding and the gaps are shares of the box's side, so the layout is the same at any size.
// Record counts and titles size nothing.
//
// Pure and deterministic: the same tree always gives the same map.

/** The padding inside a box around its children, and the gap between two siblings, at its side's text scale (its side over TEXT_SIZE). */
export const NEST_PAD = 8;
export const NEST_GAP = 6;
/** The most of its square a parent's header band takes. */
export const HEADER_SHARE = 0.25;

export interface NestedNode extends MapNode {
  /** The header band's height, in map units, its siblings' tallest label at their text scale: 0 for a box with no children (its label is centered in it). */
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
 * Lays out a tree given by its roots, a children function and, for each node, its label (its ID
 * when not given) as nested squares (exported for tests).
 */
export function layoutNested(roots: readonly string[], childrenOf: (id: string) => readonly string[], labelOf: (id: string) => MapLabel = (id) => ({ title: id, meta: '' })): NestedMap {
  // The tree, by a walk from the roots; a node reached twice keeps its first place.
  const parent = new Map<string, string | null>();
  const level = new Map<string, number>();
  const kids = new Map<string, string[]>();
  const order = new Map<string, number>();
  const visit = (id: string, up: string | null, l: number) => {
    parent.set(id, up);
    level.set(id, l);
    order.set(id, order.size);
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

  const nodes = new Map<string, NestedNode>();
  const byLevelIds: string[][] = [];
  /** Some siblings, each a square `side` across at its place: their shared text and header band, then each one's children inside it. */
  const place = (ids: readonly string[], side: number, at: readonly { x: number; y: number }[]) => {
    const most = sizeText(side);
    // Its border grows with its text, never below half (LA-EXP-DS06).
    const border = (s: number) => BORDER * Math.max(0.5, s);
    const labels = ids.map((id) => labelOf(id));
    const leaf = ids.map((id) => kids.get(id)!.length === 0);
    const text = Math.min(...labels.map((label, i) => largestFit(label, leaf[i], side, leaf[i] ? side : HEADER_SHARE * side, most, border)));
    const lines = labels.map((label, i) => linesIn(label, text > 0 ? (side - 2 * border(text)) / text : Infinity, leaf[i]));
    const header = Math.max(0, ...lines.map((l, i) => (leaf[i] ? 0 : text * labelHeight(l))));
    const pad = NEST_PAD * most;
    const gap = NEST_GAP * most;
    ids.forEach((id, i) => {
      const { x, y } = at[i];
      const own = kids.get(id)!;
      const l = level.get(id)!;
      nodes.set(id, { id, parent: parent.get(id)!, children: own, level: l, x, y, w: side, h: side, text, lines: lines[i], centered: leaf[i], header: leaf[i] ? 0 : header, order: order.get(id)! });
      (byLevelIds[l] ??= []).push(id);
      if (leaf[i]) return;
      const below = Math.max(header, pad);
      const grid = gridOf(own.length, side - 2 * pad, side - below - pad, gap);
      place(own, grid.side, own.map((_, k) => ({ x: x + pad + (k % grid.columns) * (grid.side + gap), y: y + below + Math.floor(k / grid.columns) * (grid.side + gap) })));
    });
  };
  // The roots, each the product's square, in a grid a wide gap apart.
  const rootGap = NEST_GAP * 4 * sizeText(MAP_SIZE);
  const columns = Math.ceil(Math.sqrt(top.length));
  const rows = Math.ceil(top.length / Math.max(1, columns));
  place(top, MAP_SIZE, top.map((_, k) => ({ x: (k % columns) * (MAP_SIZE + rootGap), y: Math.floor(k / columns) * (MAP_SIZE + rootGap) })));

  return {
    view: 'nested',
    nodes,
    roots: top,
    byLevel: byLevelIds.map((ids) => ids.map((id) => nodes.get(id)!)),
    width: top.length === 0 ? 0 : Math.min(columns, top.length) * (MAP_SIZE + rootGap) - rootGap,
    height: top.length === 0 ? 0 : rows * (MAP_SIZE + rootGap) - rootGap,
  };
}

const cache = new WeakMap<SpecIndex, Map<string, NestedMap>>();

/** The Nested map of one product (or of a tree no product reaches), from its root, as the Tree map has it (`mapRootOf`): built on first use, then read. */
export function nestedMap(index: SpecIndex, root: string): NestedMap {
  let maps = cache.get(index);
  if (!maps) { maps = new Map(); cache.set(index, maps); }
  const key = `${textMeasure().key}|${root}`;
  const known = maps.get(key);
  if (known) return known;
  const map = layoutNested([root], (id) => treeChildren(index, id), (id) => mapLabel(index, id));
  maps.set(key, map);
  return map;
}
