import type { SpecIndex } from '../specs/data';
import { settleLevelScale, typicalSize, type MapNode, type PlacedMap } from './map';
import { labelHeight, linesIn, mapLabel, metaWidth, narrowestWidth, titleWidth, WIDTH_MARGIN, type MapLabel, type WrappedLabel } from './text';
import { treeChildren } from './tree';

// The graph's Nested map (LA-EXP-DR62): the same tree as the Tree map (map.ts), one product's, the
// product its single root, drawn as nested squares. A product is made of its domains, a domain of
// Define and Design, a stage of its folders, a folder of its records, a record of its children:
// each box holds its children rather than linking to them. Laid out once per spec load, like the
// Tree map, and never changed by the focus: focusing moves the camera (camera.ts).
//
// One text scale per height level: a box's level is its height from the leaves (0 for a leaf, one
// more than its tallest child for a parent), so every leaf record reads at leaf size wherever it
// sits. A level's scale is its typical box size over a typical leaf's, at most MAX_LEVEL_STEP times
// the level below's (map.ts's `settleLevelScale`), so every box at one level has the same text, set
// once when the map is built and never by the focus or the zoom. Every box is a square sized to its
// content at its level's scale, from the leaves up, so every label fits by construction:
// - A leaf is the smallest square that holds its label (its kind and ID line and its title,
//   wrapped on whole words), its padding included.
// - A parent's children are packed in the tree's order in rows (shelf packing), a gap apart, within
//   a row width chosen from a few tries to make the parent's square smallest.
// - A parent is the smallest square holding its header band (its own label at its level's scale)
//   and that block below it, inside its padding. Space the block leaves is blank.
// Size follows content, not record counts.
//
// Pure and deterministic: the same tree always gives the same map.

/** The padding inside a box around its children, and the gap between two siblings, at text scale 1. */
export const NEST_PAD = 8;
export const NEST_GAP = 6;
/** How many row widths a parent tries for its children, between the widest child and one row of them all. */
const ROW_TRIES = 24;
/** How many halvings find a width at which a label's wrapping changes: to well under a thousandth of a unit. */
const SIDE_ROUNDS = 24;

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

interface Packed { w: number; h: number; at: { x: number; y: number }[] }

/**
 * Squares of some sides packed in their order in rows no wider than `width`, `gap` apart (exported
 * for tests): each row as many as fit, its height its tallest; the block's size and each square's
 * place in it.
 */
export function shelfPack(sides: readonly number[], width: number, gap: number): Packed {
  const at: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let row = 0;
  let w = 0;
  for (const s of sides) {
    if (x > 0 && x + s > width + 1e-9) { y += row + gap; x = 0; row = 0; }
    at.push({ x, y });
    x += s;
    w = Math.max(w, x);
    row = Math.max(row, s);
    x += gap;
  }
  return { w, h: sides.length === 0 ? 0 : y + row, at };
}

/** One step of a label's wrapping: the least width, at text scale 1, at which it is this tall. */
interface Step { w: number; h: number }

/**
 * A label's wrapping as steps: from the narrowest width its words allow up to
 * one line, each width at which it gets shorter (found by halving, SIDE_ROUNDS times) and how tall
 * it is from there, at text scale 1. Wider is never taller, so the steps are the whole story.
 */
function wrapSteps(label: MapLabel, centered: boolean): Step[] {
  const tall = (w: number) => labelHeight(linesIn(label, w, centered));
  const narrowest = narrowestWidth(label, centered);
  const oneLine = narrowest + (titleWidth(label.title) + metaWidth(label.meta)) * WIDTH_MARGIN + 1;
  const shortest = tall(oneLine);
  const steps: Step[] = [{ w: narrowest, h: tall(narrowest) }];
  while (steps.at(-1)!.h > shortest) {
    const at = steps.at(-1)!;
    let lo = at.w;
    let hi = oneLine;
    for (let round = 0; round < SIDE_ROUNDS; round++) {
      const mid = (lo + hi) / 2;
      if (tall(mid) < at.h) hi = mid; else lo = mid;
    }
    steps.push({ w: hi, h: tall(hi) });
  }
  return steps;
}

/**
 * The smallest square side, at text scale 1, that holds a label centered in it, wrapped on whole
 * words (exported for tests): the least width, found by halving, at which it is no taller than wide.
 */
export function leafSide(label: MapLabel): number {
  const tall = (w: number) => labelHeight(linesIn(label, w, true));
  let lo = narrowestWidth(label, true);
  let hi = Math.max(lo, tall(lo));
  if (hi <= lo) return lo;
  for (let round = 0; round < SIDE_ROUNDS; round++) {
    const mid = (lo + hi) / 2;
    if (tall(mid) <= mid) hi = mid; else lo = mid;
  }
  return hi;
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
    // Its height: 0 for a leaf, one more than its tallest child for a parent; its text's level.
    const tall = own.length === 0 ? 0 : 1 + Math.max(...own.map((c) => height.get(c)!));
    height.set(id, tall);
    (byHeightIds[tall] ??= []).push(id);
  };
  const top: string[] = [];
  for (const r of roots) { if (!level.has(r)) { top.push(r); visit(r, null, 0); } }

  /** The packing of some squares, from a few row widths, whose enclosing square (`squareFor`) is smallest. */
  const bestPack = (sides: readonly number[], gap: number, squareFor: (block: Packed) => number): { pack: Packed; side: number } => {
    const widest = Math.max(...sides);
    const all = sides.reduce((s, x) => s + x, 0) + gap * (sides.length - 1);
    let best: { pack: Packed; side: number } | null = null;
    for (let i = 0; i <= ROW_TRIES; i++) {
      const pack = shelfPack(sides, widest + ((all - widest) * i) / ROW_TRIES, gap);
      const side = squareFor(pack);
      if (!best || side < best.side - 1e-9) best = { pack, side };
    }
    return best!;
  };

  // A box's least square at a text scale, its children's sides known: a leaf's, its label's; a
  // parent's, the least that holds its header band over its children's block, inside its padding:
  // for each step of its header's wrapping, at least that step's width, and its block's width, and
  // tall enough for that step's header over the block.
  const unitLeaf = new Map<string, number>();
  const headerSteps = new Map<string, Step[]>();
  for (const [id, own] of kids) {
    if (own.length === 0) unitLeaf.set(id, leafSide(labels.get(id)!));
    else headerSteps.set(id, wrapSteps(labels.get(id)!, false));
  }
  const side = new Map<string, number>();
  const sideAt = (id: string, s: number): { side: number; pack?: Packed } => {
    const own = kids.get(id)!;
    if (own.length === 0) return { side: s * unitLeaf.get(id)! };
    const steps = headerSteps.get(id)!;
    const pad = NEST_PAD * s;
    const squareFor = (block: Packed) => Math.min(...steps.map((step) => Math.max(block.w + 2 * pad, s * step.w, Math.max(s * step.h, pad) + block.h + pad)));
    return bestPack(own.map((c) => side.get(c)!), NEST_GAP * s, squareFor);
  };

  // One text scale per height level, from the leaves up: its typical box size over a typical leaf's,
  // at most MAX_LEVEL_STEP times the level below's (map.ts's `settleLevelScale`); then each box's
  // side at that scale and, for a parent, where its children sit in it.
  const leafArea = typicalSize([...unitLeaf.values()].map((x) => x * x)) ** 2;
  const scales: number[] = new Array(byHeightIds.length).fill(1);
  const packs = new Map<string, Packed>();
  byHeightIds.forEach((ids, h) => {
    scales[h] = settleLevelScale((s) => ids.map((id) => sideAt(id, s).side ** 2), h > 0 ? scales[h - 1] : 1, leafArea);
    for (const id of ids) {
      const { side: own, pack } = sideAt(id, scales[h]);
      side.set(id, own);
      if (pack) packs.set(id, pack);
    }
  });
  const scaleOf = (id: string) => scales[height.get(id)!];

  // From the roots down: each box at its place, its children at theirs below its header.
  const nodes = new Map<string, NestedNode>();
  let order = 0;
  const place = (id: string, x: number, y: number) => {
    const own = kids.get(id)!;
    const text = scaleOf(id);
    const w = side.get(id)!;
    const centered = own.length === 0;
    const lines = linesIn(labels.get(id)!, w / text, centered);
    const header = centered ? 0 : text * labelHeight(lines);
    nodes.set(id, { id, parent: parent.get(id)!, children: own, level: level.get(id)!, x, y, w, h: w, text, lines, centered, header, order: order++ });
    if (centered) return;
    const pad = NEST_PAD * text;
    const pack = packs.get(id)!;
    own.forEach((c, i) => place(c, x + pad + pack.at[i].x, y + Math.max(header, pad) + pack.at[i].y));
  };
  // The roots packed in rows the same way, a wide gap apart.
  const rootGap = NEST_GAP * 4 * (top.length > 0 ? scaleOf(top[0]) : 1);
  const world = top.length === 0 ? { pack: { w: 0, h: 0, at: [] }, side: 0 } : bestPack(top.map((r) => side.get(r)!), rootGap, (block) => Math.max(block.w, block.h));
  top.forEach((r, i) => place(r, world.pack.at[i].x, world.pack.at[i].y));

  return {
    view: 'nested',
    nodes,
    roots: top,
    byLevel: byLevelIds.map((ids) => ids.map((id) => nodes.get(id)!)),
    width: world.pack.w,
    height: world.pack.h,
  };
}

const cache = new WeakMap<SpecIndex, Map<string, NestedMap>>();

/** The Nested map of one product (or of a tree no product reaches), from its root, as the Tree map has it (`mapRootOf`): built on first use, then read. */
export function nestedMap(index: SpecIndex, root: string): NestedMap {
  let maps = cache.get(index);
  if (!maps) { maps = new Map(); cache.set(index, maps); }
  const known = maps.get(root);
  if (known) return known;
  const map = layoutNested([root], (id) => treeChildren(index, id), (id) => mapLabel(index, id));
  maps.set(root, map);
  return map;
}
