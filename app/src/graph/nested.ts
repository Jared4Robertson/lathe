import type { SpecIndex } from '../specs/data';
import { NODE_HEIGHT, NODE_WIDTH } from './layout';
import type { MapNode, PlacedMap } from './map';
import { BADGE_ROOM, hasMarks, HEX_ROOM, LABEL_PAD, labelHeight, labelLines, metaWidth, titleWidth, WIDTH_MARGIN, wrapLabel, type WrappedLabel } from './text';
import { treeChildren } from './tree';

// The graph's Nested map (LA-EXP-DR62): the same tree as the Tree map (map.ts), one product's, the
// product its single root, drawn as a zoomable treemap. A product is made of its domains, a domain of Define and Design, a stage of
// its folders, a folder of its records, a record of its children: each box holds its children
// rather than linking to them. Laid out once per spec load, like the Tree map, and never changed
// by the focus: focusing moves the camera (camera.ts).
//
// Built from the leaves up, so every label fits by construction:
// - Leaves first: a leaf's least size is what its label (its kind and ID line and its title,
//   wrapped on whole words toward LABEL_ASPECT) needs at text scale 1, its padding included.
// - Up the tree: a parent's least size is its header band (HEADER_SHARE of its size, and at least
//   its own label at scale 1) over the least room its children need packed, a gap apart, inside
//   its padding.
// - Then top-down: each box's children share its inner room, each the larger of its share by the
//   leaf records under it and its least size, scaled so they exactly fill it; they are squarified
//   (Bruls, Huizing and van Wijk) without sorting, so they keep the tree's order row by row where
//   the shapes allow. Area stays in proportion to the records wherever the least sizes allow.
// - Each box has its own text scale, in proportion to it: the largest its label fits at in the box
//   it got (`fitScale`), a leaf's in its height and a parent's in its header band's room. So a big
//   box always has a big label, and every box shows its label (LA-EXP-DR60): the camera never
//   changes the scale.
//
// Pure and deterministic: the same tree always gives the same map.

/** The padding inside a box around its children, and the gap between two siblings, at its text scale 1. */
export const NEST_PAD = 8;
export const NEST_GAP = 6;
/** A parent's header band takes this share of its size (the square root of its area), and never more than HEADER_SHARE_MAX of its height, so a squat box keeps room for its children. */
export const HEADER_SHARE = 0.2;
export const HEADER_SHARE_MAX = 0.4;
/** The map area one leaf record stands for: a little more than a Tree leaf, for the headers and padding above it. */
export const LEAF_AREA = NODE_WIDTH * NODE_HEIGHT * 4;
/** The whole map's width over its height. */
export const NESTED_ASPECT = 1.6;
/** The shape a label wraps toward for a box's least size: about 3 wide to 2 tall. */
export const LABEL_ASPECT = 1.5;
/** How much more room children need than their least areas summed, for the squarified shapes. */
export const PACK_SLACK = 1.15;

export interface NestedNode extends MapNode {
  /** Its label's lines, wrapped on whole words for its width at its own text scale, and whether they are centered (a leaf's) or at the top left (a parent's). */
  lines: WrappedLabel;
  centered: boolean;
  /** The header band's height, in map units: 0 for a box with no children (its label is centered in it). */
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

/** What a box's label says, and what it keeps room for: a domain's hexagon mark, the problem badge. */
export interface NestedLabel { title: string; meta: string; hexagon?: boolean; marked?: boolean }

/** A label's lines in a box `width` wide at text scale 1 (text.ts's `wrapLabel`): a leaf's centered, a parent's at the top left of its header band. */
const linesIn = (label: NestedLabel, width: number, centered: boolean): WrappedLabel =>
  wrapLabel(label, { hexagon: label.hexagon, marked: label.marked, centered, width });

/** Whether every word of a label fits on a line of a box `width` wide at text scale 1, so wrapping never breaks a word. */
function wordsFit(label: NestedLabel, width: number, centered: boolean): boolean {
  const inner = width - 2 * LABEL_PAD - (label.hexagon ? 2 * HEX_ROOM : 0);
  const words = (text: string) => text.split(/\s+/).filter(Boolean);
  return words(label.title).every((w) => titleWidth(w) * WIDTH_MARGIN <= inner)
    && words(label.meta).every((w) => metaWidth(w) * WIDTH_MARGIN <= inner - (label.marked ? (centered ? 2 : 1) * BADGE_ROOM : 0));
}

/**
 * The largest text scale at which a box's label fits it (LA-EXP-DR58): its kind and ID line and
 * its title, each wrapped on whole words (text.ts's `wrapLabel`, never breaking a word), across the
 * box's width and within `room` of its height (a leaf's whole height; a parent's header band, at
 * most its share). 0 when a word can never fit.
 */
export function fitScale(r: Pick<Rect, 'w' | 'h'>, label: NestedLabel, room = r.h, centered = true): number {
  const fits = (s: number) => wordsFit(label, r.w / s, centered) && labelHeight(linesIn(label, r.w / s, centered)) <= room / s;
  let lo = 0;
  let hi = room / labelHeight({ title: [''], meta: [''], file: false });
  if (hi <= 0) return 0;
  if (fits(hi)) return hi;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid; else hi = mid;
  }
  return lo;
}

/** The room a parent's header band takes: HEADER_SHARE of its size, at most HEADER_SHARE_MAX of its height. */
export const headerRoom = (r: Pick<Rect, 'w' | 'h'>) => Math.min(HEADER_SHARE_MAX * r.h, HEADER_SHARE * Math.sqrt(r.w * r.h));

/**
 * The least box a label needs at text scale 1 (exported for tests): wrapped on whole words in the
 * width, from the narrowest its words allow to one line, whose shape is nearest LABEL_ASPECT.
 */
export function labelBox(label: NestedLabel, centered: boolean): { w: number; h: number } {
  const pad = 2 * LABEL_PAD + (label.hexagon ? 2 * HEX_ROOM : 0);
  const words = (text: string, measure: (s: string) => number) => text.split(/\s+/).filter(Boolean).map((w) => measure(w) * WIDTH_MARGIN);
  const badge = label.marked ? (centered ? 2 : 1) * BADGE_ROOM : 0;
  const narrowest = pad + Math.max(1, ...words(label.title, titleWidth), ...words(label.meta, metaWidth).map((w) => w + badge));
  const widest = pad + Math.max(titleWidth(label.title), metaWidth(label.meta) + badge) * WIDTH_MARGIN + 1;
  let best = { w: widest, h: labelHeight(linesIn(label, widest, centered)) };
  for (let i = 0; i <= 8; i++) {
    const w = narrowest + ((widest - narrowest) * i) / 8;
    const h = labelHeight(linesIn(label, w, centered));
    if (Math.abs(Math.log(w / h / LABEL_ASPECT)) < Math.abs(Math.log(best.w / best.h / LABEL_ASPECT))) best = { w, h };
  }
  return best;
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
export function layoutNested(roots: readonly string[], childrenOf: (id: string) => readonly string[], labelOf: (id: string) => NestedLabel = (id) => ({ title: id, meta: '' })): NestedMap {
  // The tree, by a walk from the roots; a node reached twice keeps its first place.
  const parent = new Map<string, string | null>();
  const level = new Map<string, number>();
  const kids = new Map<string, string[]>();
  const leaves = new Map<string, number>();
  const least = new Map<string, number>();
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
    leaves.set(id, own.length === 0 ? 1 : own.reduce((s, c) => s + leaves.get(c)!, 0));
    // From the leaves up: a leaf's least area is its label's box; a parent's, its header over its children packed inside its padding.
    const label = labelBox(labelOf(id), own.length === 0);
    if (own.length === 0) { least.set(id, label.w * label.h); return; }
    const side = Math.sqrt(PACK_SLACK * own.reduce((s, c) => s + (Math.sqrt(least.get(c)!) + NEST_GAP) ** 2, 0));
    // A square whose header band (HEADER_SHARE of its side) and padding leave the children their side, and wide and tall enough for its label.
    const square = Math.max((side + 2 * NEST_PAD) / (1 - HEADER_SHARE), label.w, label.h / HEADER_SHARE);
    least.set(id, square * square);
  };
  const top: string[] = [];
  for (const r of roots) { if (!level.has(r)) { top.push(r); visit(r, null, 0); } }

  const total = top.reduce((s, r) => s + leaves.get(r)!, 0);
  const area = Math.max(total * LEAF_AREA, PACK_SLACK * top.reduce((s, r) => s + (Math.sqrt(least.get(r)!) + 4 * NEST_GAP) ** 2, 0));
  const height = Math.sqrt(area / NESTED_ASPECT);
  const world = { x: 0, y: 0, w: total === 0 ? 0 : height * NESTED_ASPECT, h: total === 0 ? 0 : height };

  // Top-down: each box's text scale and header, then its children's rooms inside it.
  const nodes = new Map<string, NestedNode>();
  const place = (id: string, r: Rect) => {
    const own = kids.get(id)!;
    const label = labelOf(id);
    const centered = own.length === 0;
    // In proportion to the box: the largest its label fits at in it.
    const text = fitScale(r, label, own.length > 0 ? headerRoom(r) : r.h, centered);
    const lines = linesIn(label, text > 0 ? r.w / text : 0, centered);
    const header = own.length > 0 && text > 0 ? text * labelHeight(lines) : 0;
    nodes.set(id, { id, parent: parent.get(id)!, children: own, level: level.get(id)!, x: r.x, y: r.y, w: r.w, h: r.h, text, lines, centered, header, order: 0 });
    if (own.length === 0) return;
    // The padding and gaps grow with the box as its text does, at least their scale-1 size.
    const pad = NEST_PAD * Math.max(1, text);
    const gap = NEST_GAP * Math.max(1, text);
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
  const rootGap = NEST_GAP * 4;
  if (top.length === 1) place(top[0], world);
  else {
    const rooms = shareRoom((world.w + rootGap) * (world.h + rootGap), top.map((r) => leaves.get(r)!), top.map((r) => (Math.sqrt(least.get(r)!) + rootGap) ** 2));
    const cells = squarify(rooms, { x: -rootGap / 2, y: -rootGap / 2, w: world.w + rootGap, h: world.h + rootGap });
    top.forEach((r, i) => { const c = cells[i]; place(r, { x: c.x + rootGap / 2, y: c.y + rootGap / 2, w: Math.max(0, c.w - rootGap), h: Math.max(0, c.h - rootGap) }); });
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
