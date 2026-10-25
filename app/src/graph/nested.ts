import type { SpecIndex } from '../specs/data';
import { NODE_HEIGHT, NODE_WIDTH } from './layout';
import type { MapNode, PlacedMap } from './map';
import { BADGE_ROOM, hasMarks, HEX_ROOM, LABEL_PAD, labelLines, labelWidth, META_FONT, metaWidth, TITLE_FONT, titleWidth, WIDTH_MARGIN } from './text';
import { treeChildren } from './tree';

// The graph's Nested map (LA-EXP-DR62): the same tree as the Tree map (map.ts), one product's, the
// product its single root, drawn as a zoomable treemap. A product is made of its domains, a domain of Define and Design, a stage of
// its folders, a folder of its records, a record of its children: each box holds its children
// rather than linking to them. Laid out once per spec load, like the Tree map, and never changed
// by the focus: focusing moves the camera (camera.ts).
//
// - A box's area is in proportion to the leaf records under it (a leaf counts one).
// - Each box with children has a header band with its label at the top; its children sit below it,
//   inside a padding, squarified (Bruls, Huizing and van Wijk) without sorting, so they keep the
//   tree's order row by row where the shapes allow.
// - A box's text scale is fixed here, in proportion to the box (LA-EXP-DR58): its label on one
//   line fits its width (a parent's within 0.6 of it), and a header band takes at most 0.4 of its
//   box's height over the square root of the leaves under it (between an eighth and 0.4). The camera
//   never changes it, and hides a label too small to read (LA-EXP-DR60).
//
// Pure and deterministic: the same tree always gives the same map.

/** A header band's height at text scale 1: the kind and ID line and the title, with their padding. */
export const HEADER = 46;
/** The padding inside a box around its children, and the gap between two siblings, at its text scale 1. */
export const NEST_PAD = 8;
export const NEST_GAP = 6;
/**
 * How tall a header band is at most, as a share of its box's size (the square root of its area):
 * HEADER_SHARE_MAX over the square root of the leaves under it, never more than HEADER_SHARE_MAX
 * nor less than HEADER_SHARE_MIN, so a parent of one record has room for its name and a parent of
 * hundreds does not crowd them; and never more than HEADER_SHARE_MAX of its height, so a squat box
 * keeps room for its children. A header's label takes at most HEADER_WIDTH_SHARE of its box's width.
 */
export const HEADER_SHARE_MAX = 0.4;
export const HEADER_SHARE_MIN = 0.2;
export const HEADER_WIDTH_SHARE = 0.9;
export const headerShare = (leaves: number) => Math.min(HEADER_SHARE_MAX, Math.max(HEADER_SHARE_MIN, HEADER_SHARE_MAX / Math.sqrt(Math.max(1, leaves))));
/** The map area one leaf record stands for: a little more than a Tree leaf, for the headers and padding above it. */
export const LEAF_AREA = NODE_WIDTH * NODE_HEIGHT * 4;
/** The whole map's width over its height. */
export const NESTED_ASPECT = 1.6;

export interface NestedNode extends MapNode {
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

/**
 * A parent's text scale in the Nested map (LA-EXP-DR58): as large as keeps its label on one line
 * within HEADER_WIDTH_SHARE of its width, and its header band within its share of its size
 * (`headerShare`, by the leaves under it) and HEADER_SHARE_MAX of its height.
 */
export function nestedTextScale(r: Pick<Rect, 'w' | 'h'>, labelWidth: number, leaves: number): number {
  const across = (HEADER_WIDTH_SHARE * r.w) / Math.max(1, labelWidth);
  const down = Math.min(HEADER_SHARE_MAX * r.h, headerShare(leaves) * Math.sqrt(r.w * r.h)) / HEADER;
  return Math.max(0, Math.min(across, down));
}

/** What a box's label says, and what it keeps room for: a domain's hexagon mark, the problem badge. */
export interface NestedLabel { title: string; meta: string; hexagon?: boolean; marked?: boolean }

/** A label's line height, as a share of its font size, and its padding top and bottom, at text scale 1 (the stylesheet's). */
const LINE = 1.4;
const LABEL_PAD_Y = 6;

/** How many lines some words take, wrapped at their spaces in a width (all at one scale), or Infinity when a word is wider. */
function wrap(words: readonly number[], space: number, width: number): number {
  if (width <= 0 || words.some((w) => w > width)) return Infinity;
  let lines = words.length > 0 ? 1 : 0;
  let line = 0;
  for (const w of words) {
    if (line === 0) line = w;
    else if (line + space + w <= width) line += space + w;
    else { lines++; line = w; }
  }
  return lines;
}

/**
 * The height a leaf's label takes at text scale 1 in a width: its kind and ID line and its title,
 * each wrapped at its spaces (never inside a word), the kind and ID line keeping room for the
 * problem badge on both sides; Infinity when a word does not fit.
 */
function wrappedHeight(label: NestedLabel, width: number): number {
  const split = (text: string) => text.split(/\s+/).filter(Boolean);
  const meta = wrap(split(label.meta).map((w) => metaWidth(w) * WIDTH_MARGIN), metaWidth(' '), width - (label.marked ? 2 * BADGE_ROOM : 0));
  const title = wrap(split(label.title).map((w) => titleWidth(w) * WIDTH_MARGIN), titleWidth(' ') * WIDTH_MARGIN, width);
  return 2 * LABEL_PAD_Y + meta * META_FONT * LINE + title * TITLE_FONT * LINE;
}

/**
 * A leaf's text scale in the Nested map (LA-EXP-DR58): the largest at which its kind and ID line
 * and its title, each wrapped at its spaces (never inside a word), fit its width and height. A
 * leaf is a block, not a line, so a long title takes two or three lines rather than a tiny one.
 */
export function leafTextScale(r: Pick<Rect, 'w' | 'h'>, label: NestedLabel): number {
  const fits = (s: number) => {
    const width = r.w / s - 2 * LABEL_PAD - (label.hexagon ? 2 * HEX_ROOM : 0) - 4;
    return wrappedHeight(label, width) <= r.h / s;
  };
  let lo = 0;
  let hi = r.h / (2 * LABEL_PAD_Y + (META_FONT + TITLE_FONT) * LINE);
  if (hi <= 0) return 0;
  if (fits(hi)) return hi;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid; else hi = mid;
  }
  return lo;
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
  };
  const top: string[] = [];
  for (const r of roots) { if (!level.has(r)) { top.push(r); visit(r, null, 0); } }

  const total = top.reduce((s, r) => s + leaves.get(r)!, 0);
  const height = Math.sqrt((total * LEAF_AREA) / NESTED_ASPECT);
  const world = { x: 0, y: 0, w: total === 0 ? 0 : height * NESTED_ASPECT, h: total === 0 ? 0 : height };

  const nodes = new Map<string, NestedNode>();
  let order = 0;
  /** Places a box, then its children inside it below its header band. */
  const place = (id: string, r: Rect) => {
    const own = kids.get(id)!;
    const label = labelOf(id);
    const text = own.length > 0 ? nestedTextScale(r, labelWidth(label, label), leaves.get(id)!) : leafTextScale(r, label);
    const header = own.length > 0 ? HEADER * text : 0;
    nodes.set(id, { id, parent: parent.get(id)!, children: own, level: level.get(id)!, x: r.x, y: r.y, w: r.w, h: r.h, text, header, order: order++ });
    if (own.length === 0) return;
    const pad = NEST_PAD * text;
    const gap = NEST_GAP * text;
    const inner = { x: r.x + pad - gap / 2, y: r.y + header - gap / 2, w: r.w - 2 * pad + gap, h: r.h - header - pad + gap };
    const cells = squarify(own.map((c) => leaves.get(c)!), inner);
    own.forEach((c, i) => {
      const cell = cells[i];
      place(c, { x: cell.x + gap / 2, y: cell.y + gap / 2, w: Math.max(0, cell.w - gap), h: Math.max(0, cell.h - gap) });
    });
  };
  // Several roots share the world as one box's children would, with a root gap between them.
  const rootGap = NEST_GAP * 4;
  const cells = squarify(top.map((r) => leaves.get(r)!), { x: -rootGap / 2, y: -rootGap / 2, w: world.w + rootGap, h: world.h + rootGap });
  top.forEach((r, i) => {
    const c = cells[i];
    place(r, top.length === 1 ? world : { x: c.x + rootGap / 2, y: c.y + rootGap / 2, w: Math.max(0, c.w - rootGap), h: Math.max(0, c.h - rootGap) });
  });

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
