import type { SpecIndex } from '../specs/data';
import { NODE_HEIGHT, NODE_WIDTH } from './layout';
import { settleLevelScale, type MapNode, type PlacedMap } from './map';
import { hasMarks, labelBox, labelHeight, labelLines, linesIn, narrowestWidth, wordsFit, type MapLabel, type WrappedLabel } from './text';
import { treeChildren } from './tree';

// The graph's Nested map (LA-EXP-DR62): the same tree as the Tree map (map.ts), one product's, the
// product its single root, drawn as a zoomable treemap. A product is made of its domains, a domain of Define and Design, a stage of
// its folders, a folder of its records, a record of its children: each box holds its children
// rather than linking to them. Laid out once per spec load, like the Tree map, and never changed
// by the focus: focusing moves the camera (camera.ts).
//
// One text scale per height level: a box's level is its height from the leaves (0 for a leaf, one
// more than its tallest child for a parent), so every leaf record reads at leaf size wherever it
// sits. A level's scale is its typical box size (by records, or by what its labels need) over a
// leaf's, at most MAX_LEVEL_STEP times the level below's (map.ts's `settleLevelScale`), so every
// box at one level has the same text, set once when the map is built and never by the focus or the zoom. Every box is
// then sized to hold its label at its level's scale, from the leaves up, so every label fits by
// construction:
// - Leaves first: a leaf's least size is its label (its kind and ID line and its title, wrapped on
//   whole words toward LABEL_ASPECT) at its level's scale, its padding included.
// - Up the tree: a parent's least size is its header (its own label, at its level's scale) over the
//   least room its children need packed, a gap apart, inside its padding.
// - Then top-down: each box's children share its inner room, each the larger of its share by the
//   leaf records under it and its least size, scaled so they exactly fill it; they are squarified
//   (Bruls, Huizing and van Wijk) without sorting, so they keep the tree's order row by row where
//   the shapes allow. Area stays in proportion to the records wherever the least sizes allow.
// - A squarified cell's shape is not its least size's: a box whose label still does not fit the
//   cell it got (too narrow for a word, or too short) has its least area grown, and the map is
//   laid out again, up to FIT_PASSES times. A label never shrinks below its level's scale.
//
// Pure and deterministic: the same tree always gives the same map.

/** The padding inside a box around its children, and the gap between two siblings, at text scale 1. */
export const NEST_PAD = 8;
export const NEST_GAP = 6;
/** The map area one leaf record stands for: a little more than a Tree leaf, for the headers and padding above it. */
export const LEAF_AREA = NODE_WIDTH * NODE_HEIGHT * 4;
/** The whole map's width over its height. */
export const NESTED_ASPECT = 1.6;
/** How much more room children need than their least areas summed, for the squarified shapes. */
export const PACK_SLACK = 1.15;
/** How many times the map is laid out again for boxes whose label does not fit their cell, and how much such a box's least area grows each time. */
export const FIT_PASSES = 40;
export const FIT_GROWTH = 1.5;

export interface NestedNode extends MapNode {
  /** Its label's lines, wrapped on whole words for its width at its level's text scale, and whether they are centered (a leaf's) or at the top left (a parent's). */
  lines: WrappedLabel;
  centered: boolean;
  /** The header band's height, in map units, its label's at its level's scale: 0 for a box with no children (its label is centered in it). */
  header: number;
  /** Its place in the tree's order, a parent before its children: the keyboard's order. */
  order: number;
}

export interface NestedMap extends PlacedMap {
  view: 'nested';
  nodes: ReadonlyMap<string, NestedNode>;
}

interface Rect { x: number; y: number; w: number; h: number }

/** The worst aspect ratio of a row of areas laid along a side of length `side`. */
function worst(row: readonly number[], side: number): number {
  const sum = row.reduce((s, a) => s + a, 0);
  if (sum <= 0 || side <= 0) return Infinity;
  const max = Math.max(...row);
  const min = Math.min(...row);
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

/**
 * Squarified rectangles for some weights in a rectangle, in their given order (exported for
 * tests): row after row along the rectangle's shorter side, each row taking as many of the next
 * weights as keep its boxes nearest to square. A weight of 0 gets an empty box.
 */
export function squarify(weights: readonly number[], r: Rect): Rect[] {
  const out: Rect[] = weights.map(() => ({ x: r.x, y: r.y, w: 0, h: 0 }));
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0 || r.w <= 0 || r.h <= 0) return out;
  const scale = (r.w * r.h) / total;
  const items = weights.map((w, i) => ({ i, a: w * scale })).filter((x) => x.a > 0);
  let rest = { ...r };
  let at = 0;
  while (at < items.length) {
    const side = Math.min(rest.w, rest.h);
    const row = [items[at]];
    let next = at + 1;
    while (next < items.length && worst([...row, items[next]].map((x) => x.a), side) <= worst(row.map((x) => x.a), side)) row.push(items[next++]);
    const sum = row.reduce((s, x) => s + x.a, 0);
    const last = next >= items.length;
    if (rest.w >= rest.h) {
      // A column at the left, top to bottom.
      const w = last ? rest.w : sum / rest.h;
      let y = rest.y;
      for (const x of row) { const h = (x.a / sum) * rest.h; out[x.i] = { x: rest.x, y, w, h }; y += h; }
      rest = { x: rest.x + w, y: rest.y, w: rest.w - w, h: rest.h };
    } else {
      // A row at the top, left to right.
      const h = last ? rest.h : sum / rest.w;
      let x0 = rest.x;
      for (const x of row) { const w = (x.a / sum) * rest.w; out[x.i] = { x: x0, y: rest.y, w, h }; x0 += w; }
      rest = { x: rest.x, y: rest.y + h, w: rest.w, h: rest.h - h };
    }
    at = next;
  }
  return out;
}

/**
 * Each child's area of `room`: the larger of its share by `weights` and its least area, the excess
 * taken from those above their least in proportion to how far above, so the areas sum to `room`
 * (exported for tests). When `room` is under the least areas summed, each gets its least area scaled down.
 */
export function shareRoom(room: number, weights: readonly number[], least: readonly number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0);
  const sumLeast = least.reduce((s, a) => s + a, 0);
  if (sumLeast >= room) return least.map((a) => (sumLeast > 0 ? (a * room) / sumLeast : 0));
  const share = weights.map((w) => (total > 0 ? (room * w) / total : 0));
  const out = share.map((s, i) => Math.max(s, least[i]));
  const excess = out.reduce((s, a) => s + a, 0) - room;
  if (excess <= 0) return out;
  const slack = out.reduce((s, a, i) => s + (a - least[i]), 0);
  return out.map((a, i) => a - ((a - least[i]) * excess) / slack);
}

/**
 * Lays out a tree given by its roots, a children function and, for each node, its label (its ID
 * when not given) as nested boxes (exported for tests).
 */
export function layoutNested(roots: readonly string[], childrenOf: (id: string) => readonly string[], labelOf: (id: string) => MapLabel = (id) => ({ title: id, meta: '' })): NestedMap {
  // The tree, by a walk from the roots; a node reached twice keeps its first place.
  const parent = new Map<string, string | null>();
  const level = new Map<string, number>();
  const kids = new Map<string, string[]>();
  const leaves = new Map<string, number>();
  const labels = new Map<string, MapLabel>();
  const byLevelIds: string[][] = [];
  const height = new Map<string, number>();
  const byHeightIds: string[][] = [];
  const visit = (id: string, up: string | null, l: number) => {
    parent.set(id, up);
    level.set(id, l);
    labels.set(id, labelOf(id));
    (byLevelIds[l] ??= []).push(id);
    const own: string[] = [];
    kids.set(id, own);
    for (const c of childrenOf(id)) {
      if (level.has(c)) continue;
      own.push(c);
      visit(c, id, l + 1);
    }
    leaves.set(id, own.length === 0 ? 1 : own.reduce((s, c) => s + leaves.get(c)!, 0));
    // Its height: 0 for a leaf, one more than its tallest child for a parent; its text's level.
    const tall = own.length === 0 ? 0 : 1 + Math.max(...own.map((c) => height.get(c)!));
    height.set(id, tall);
    (byHeightIds[tall] ??= []).push(id);
  };
  const top: string[] = [];
  for (const r of roots) { if (!level.has(r)) { top.push(r); visit(r, null, 0); } }

  const leafBoxes = new Map<string, { w: number; h: number }>();
  const narrowest = new Map<string, number>();
  for (const [id, own] of kids) {
    if (own.length === 0) leafBoxes.set(id, labelBox(labels.get(id)!, true));
    else narrowest.set(id, narrowestWidth(labels.get(id)!, false));
  }

  // A box's least area at a text scale: a leaf's, its label's box at that scale; a parent's, its
  // header at that scale over its children packed inside its padding.
  const least = new Map<string, number>();
  const leastAt = (id: string, s: number): number => {
    const own = kids.get(id)!;
    if (own.length === 0) { const box = leafBoxes.get(id)!; return box.w * box.h * s * s; }
    const pad = NEST_PAD * s;
    const gap = NEST_GAP * s;
    // The children's room: a square, each child's least area with its gap around it, and some slack for the squarified shapes.
    const room = PACK_SLACK * own.reduce((sum, c) => sum + (Math.sqrt(least.get(c)!) + gap) ** 2, 0);
    const w = Math.max(Math.sqrt(room) - gap + 2 * pad, narrowest.get(id)! * s);
    const header = s * labelHeight(linesIn(labels.get(id)!, w / s, false));
    return w * (Math.max(header, pad) + pad - gap + room / (w - 2 * pad + gap));
  };

  // One text scale per height level, from the leaves up: its typical box size over a leaf's, each box
  // planned at the larger of its share by records and its least area at that scale, at most
  // MAX_LEVEL_STEP times the level below's (map.ts's `settleLevelScale`).
  const scales: number[] = new Array(byHeightIds.length).fill(1);
  byHeightIds.forEach((ids, h) => {
    scales[h] = settleLevelScale((s) => ids.map((id) => Math.max(leaves.get(id)! * LEAF_AREA, leastAt(id, s))), h > 0 ? scales[h - 1] : 1, LEAF_AREA);
    for (const id of ids) least.set(id, leastAt(id, scales[h]));
  });
  const scaleOf = (id: string) => scales[height.get(id)!];

  // From the leaves up, each box's least area at its level's scale, and at least what an earlier pass found it needs (`grown`).
  const grown = new Map<string, number>();
  const sizeUp = () => {
    byHeightIds.forEach((ids, h) => { for (const id of ids) least.set(id, Math.max(leastAt(id, scales[h]), grown.get(id) ?? 0)); });
  };

  const total = top.reduce((s, r) => s + leaves.get(r)!, 0);
  const rootGap = NEST_GAP * 4;
  let nodes = new Map<string, NestedNode>();
  let world = { x: 0, y: 0, w: 0, h: 0 };
  for (let pass = 0; pass <= FIT_PASSES; pass++) {
    sizeUp();
    const area = Math.max(total * LEAF_AREA, PACK_SLACK * top.reduce((s, r) => s + (Math.sqrt(least.get(r)!) + rootGap) ** 2, 0));
    const height = Math.sqrt(area / NESTED_ASPECT);
    world = { x: 0, y: 0, w: total === 0 ? 0 : height * NESTED_ASPECT, h: total === 0 ? 0 : height };

    // Top-down: each box's label at its level's scale and its header, then its children's rooms inside it.
    nodes = new Map();
    const misfits: string[] = [];
    const place = (id: string, r: Rect) => {
      const own = kids.get(id)!;
      const label = labels.get(id)!;
      const centered = own.length === 0;
      const text = scaleOf(id);
      const lines = linesIn(label, r.w / text, centered);
      const height = text * labelHeight(lines);
      const header = centered ? 0 : height;
      const pad = NEST_PAD * text;
      const gap = NEST_GAP * text;
      // Its label fits its box at its level's scale: every word across, and every line within its height (a parent's above its padding).
      if (!wordsFit(label, r.w / text, centered) || (centered ? height : Math.max(header, pad) + pad) > r.h + 1e-6) misfits.push(id);
      nodes.set(id, { id, parent: parent.get(id)!, children: own, level: level.get(id)!, x: r.x, y: r.y, w: r.w, h: r.h, text, lines, centered, header, order: 0 });
      if (own.length === 0) return;
      const inner = { x: r.x + pad - gap / 2, y: r.y + Math.max(header, pad) - gap / 2, w: Math.max(0, r.w - 2 * pad + gap), h: Math.max(0, r.h - Math.max(header, pad) - pad + gap) };
      const rooms = shareRoom(inner.w * inner.h, own.map((c) => leaves.get(c)!), own.map((c) => (Math.sqrt(least.get(c)!) + gap) ** 2));
      const cells = squarify(rooms, inner);
      own.forEach((c, i) => {
        const cell = cells[i];
        // Never more than half a small cell for the gap, so no child is squeezed to nothing.
        const g = Math.min(gap, cell.w / 2, cell.h / 2);
        place(c, { x: cell.x + g / 2, y: cell.y + g / 2, w: Math.max(0, cell.w - g), h: Math.max(0, cell.h - g) });
      });
    };
    if (top.length === 1) place(top[0], world);
    else {
      const rooms = shareRoom((world.w + rootGap) * (world.h + rootGap), top.map((r) => leaves.get(r)!), top.map((r) => (Math.sqrt(least.get(r)!) + rootGap) ** 2));
      const cells = squarify(rooms, { x: -rootGap / 2, y: -rootGap / 2, w: world.w + rootGap, h: world.h + rootGap });
      top.forEach((r, i) => { const c = cells[i]; place(r, { x: c.x + rootGap / 2, y: c.y + rootGap / 2, w: Math.max(0, c.w - rootGap), h: Math.max(0, c.h - rootGap) }); });
    }
    if (misfits.length === 0) break;
    // A box whose label does not fit the cell it got needs more room than it had: grow its least area, and lay the map out again.
    for (const id of misfits) { const n = nodes.get(id)!; grown.set(id, FIT_GROWTH * Math.max(least.get(id)!, n.w * n.h)); }
  }
  // The keyboard's order: the tree's, a parent before its children.
  let order = 0;
  const number = (id: string) => { nodes.get(id)!.order = order++; for (const c of kids.get(id)!) number(c); };
  for (const r of top) number(r);

  return {
    view: 'nested',
    nodes,
    roots: top,
    byLevel: byLevelIds.map((ids) => ids.map((id) => nodes.get(id)!)),
    width: world.w,
    height: world.h,
  };
}

const cache = new WeakMap<SpecIndex, Map<string, NestedMap>>();

/** The Nested map of one product (or of a tree no product reaches), from its root, as the Tree map has it (`mapRootOf`): built on first use, then read. */
export function nestedMap(index: SpecIndex, root: string): NestedMap {
  let maps = cache.get(index);
  if (!maps) { maps = new Map(); cache.set(index, maps); }
  const known = maps.get(root);
  if (known) return known;
  const map = layoutNested([root], (id) => treeChildren(index, id), (id) => ({ ...labelLines(index, id), hexagon: index.byId.get(id)?.kind === 'domain', marked: hasMarks(index, id) }));
  maps.set(root, map);
  return map;
}
