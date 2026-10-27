import { voronoiMapSimulation, type VoronoiMapPolygon } from 'd3-voronoi-map';
import polylabel from 'polylabel';
import type { SpecIndex } from '../specs/data';
import { MAP_SIZE, sizeText, type MapNode, type PlacedMap } from './map';
import { labelHeight, linesIn as linesAt, mapLabel, narrowestWidth, textMeasure, type MapLabel, type WrappedLabel } from './text';
import type { MeasureSpec } from './fonts';
import { treeChildren } from './tree';

// The graph's Voronoi map (LA-EXP-DR64): the same tree as the Tree and Nested maps, one product's,
// the product its single root, drawn as a Voronoi treemap. The product is a hexagon split into
// polygon cells, one per stage and domain; a domain's cell is split into its stages, and so on down.
// Laid out once per spec load and never changed by the focus: focusing moves the camera (camera.ts).
//
// The one rule (LA-EXP-DR58), top-down from the product's hexagon, MAP_SIZE across: siblings are
// the same size, with the same text.
// - Each parent's cell, inside its padding and below its header, is split into equal-area cells for
//   its children, within about 5%: a Voronoi diagram (a power diagram) clipped to it, iterated
//   until the areas match (d3-voronoi-map). Record counts size nothing.
// - Every cell is convex: the product's hexagon is, and a power diagram's cells clipped to a convex
//   outline are, so a cell's outline, its inset and its header's cut are all found by clipping.
// - Seeds are deterministic: a parent's children start evenly round a circle about its largest
//   inscribed point, in the tree's order clockwise from the upper left, each nudged by its ID, so
//   the same spec always gives the same picture.
// - Stability: the diagram is chaotic (a tiny change of input can end in a different picture), so
//   each parent is laid out in its own frame: adding a record changes only its parent's split, and
//   everything outside that parent's cell keeps its place exactly.
// - Siblings share one text scale: their size (the square root of a cell's area) over TEXT_SIZE,
//   or the largest below it at which every sibling's label fits its room, the smallest sibling
//   cell's room deciding. A leaf's label is centered on its largest inscribed point; a parent's
//   sits in a header at the top of its cell, its children below the header's cut. A label wraps on
//   whole words and is never clipped, so every drawn cell shows its name (LA-PAT-APP-UX-R12).
// - Laid out in a web worker (voronoi.worker.ts) where there is one: a large product takes a few
//   hundred milliseconds.
//
// Pure and deterministic: the same tree always gives the same map.

type XY = [number, number];
type Polygon = readonly XY[];

/** The product's hexagon: a flat-topped regular hexagon MAP_SIZE across. */
export const PRODUCT_AREA = ((3 * Math.sqrt(3)) / 8) * MAP_SIZE ** 2;
/** The padding inside a cell around its children, and the gap between two siblings, at its size's text scale (the square root of its area over TEXT_SIZE). */
export const CELL_PAD = 10;
export const CELL_GAP = 8;
/** A header never leaves its children less than this share of the cell. */
export const MIN_CHILD_SHARE = 0.55;
/** The area error the layout stops at (over the parent's area), and the most rounds it takes to get there. */
export const CONVERGENCE = 0.002;
export const MAX_ROUNDS = 400;
/** How many halvings find the largest scale a cell's label fits at, and how far a scale steps down when one sibling's label does not fit at their shared one. */
const FIT_ROUNDS = 30;
const STEP_DOWN = 0.9;
const STEPS_DOWN = 120;

export interface VoronoiNode extends MapNode {
  /** Its outline's corners, in world coordinates; x, y, w and h are its bounding box. */
  polygon: Polygon;
  /** Its label's lines, wrapped on whole words, always centered, and the box they fill, in world coordinates. */
  lines: WrappedLabel;
  centered: true;
  label: { x: number; y: number; w: number; h: number };
  /** Where its children's outline is cut below its header (world y); its top when it has no header. */
  cut: number;
  /** Its place in the tree's order, a parent before its children: the keyboard's order. */
  order: number;
}

export interface VoronoiMap extends PlacedMap {
  view: 'voronoi';
  nodes: ReadonlyMap<string, VoronoiNode>;
}

// ---------- Convex polygons ----------

/** A polygon's signed area (positive when its corners run counterclockwise in y-up terms). */
export function signedArea(p: Polygon): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const [x0, y0] = p[i]; const [x1, y1] = p[(i + 1) % p.length]; a += x0 * y1 - x1 * y0; }
  return a / 2;
}
export const polygonArea = (p: Polygon) => Math.abs(signedArea(p));

/** The part of a polygon where a·x + b·y + c ≥ 0 (Sutherland and Hodgman, one edge). */
function clipHalf(p: Polygon, a: number, b: number, c: number): XY[] {
  const out: XY[] = [];
  const side = (q: XY) => a * q[0] + b * q[1] + c;
  for (let i = 0; i < p.length; i++) {
    const cur = p[i];
    const next = p[(i + 1) % p.length];
    const sc = side(cur);
    const sn = side(next);
    if (sc >= 0) out.push(cur);
    if ((sc >= 0) !== (sn >= 0)) { const t = sc / (sc - sn); out.push([cur[0] + t * (next[0] - cur[0]), cur[1] + t * (next[1] - cur[1])]); }
  }
  return out;
}

/** A convex polygon with every edge moved in by `d`: empty when it is too small for that. */
export function inset(p: Polygon, d: number): XY[] {
  if (d <= 0 || p.length < 3) return [...p];
  const s = Math.sign(signedArea(p)) || 1;
  let out: XY[] = [...p];
  for (let i = 0; i < p.length && out.length >= 3; i++) {
    const [x0, y0] = p[i];
    const [x1, y1] = p[(i + 1) % p.length];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len === 0) continue;
    // The inward normal: left of the edge for a counterclockwise polygon, right for a clockwise one.
    const a = (-s * (y1 - y0)) / len;
    const b = (s * (x1 - x0)) / len;
    out = clipHalf(out, a, b, -(a * x0 + b * y0) - d);
  }
  return out.length >= 3 ? out : [];
}

/** The part of a polygon at or below a height (y grows downward). */
export const below = (p: Polygon, y: number): XY[] => clipHalf(p, 0, 1, -y);

/** Where a horizontal line crosses a convex polygon: its left and right ends, or null when it misses. */
export function chord(p: Polygon, y: number): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i];
    const [x1, y1] = p[(i + 1) % p.length];
    if ((y0 - y) * (y1 - y) > 0 || (y0 === y1 && y0 !== y)) continue;
    const xs = y0 === y1 ? [x0, x1] : [x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)];
    for (const x of xs) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  }
  return lo <= hi ? [lo, hi] : null;
}

/** Whether a point is inside a convex polygon, its edges included. */
export function contains(p: Polygon, [x, y]: XY): boolean {
  let sign = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i];
    const [x1, y1] = p[(i + 1) % p.length];
    const cross = (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0);
    const scale = Math.hypot(x1 - x0, y1 - y0) * 1e-9 + 1e-9;
    if (Math.abs(cross) <= scale) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
}

/** Whether a rectangle lies inside a convex polygon: its four corners do. */
export const holds = (p: Polygon, r: { x: number; y: number; w: number; h: number }) =>
  [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].every((c) => contains(p, c as XY));

export function bounds(p: Polygon) {
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** A flat-topped regular hexagon of some area, its bounding box at (0, 0): the product's outline. */
export function hexagon(area: number): XY[] {
  const r = Math.sqrt((2 * area) / (3 * Math.sqrt(3)));
  const h = Math.sqrt(3) * r;
  return [[r / 2, 0], [1.5 * r, 0], [2 * r, h / 2], [1.5 * r, h], [r / 2, h], [0, h / 2]];
}

// ---------- Labels ----------

/** A cell's label's lines in a width at text scale 1: always centered. */
const linesIn = (label: MapLabel, width: number): WrappedLabel => linesAt(label, width, true);

/** A cell's size's text scale: the square root of its area over TEXT_SIZE, the most its label's scale may be. */
export const cellText = (p: Polygon) => sizeText(Math.sqrt(polygonArea(p)));

interface Placed { lines: WrappedLabel; label: { x: number; y: number; w: number; h: number }; cut: number }

/** Line widths to try a label at, as shares of the room across: the widest first. */
const WIDTHS = [0.96, 0.88, 0.8, 0.72, 0.64, 0.56, 0.48, 0.4];

/** A leaf's label at a scale, centered on the cell's largest inscribed point, as wide as the cell allows: null when it does not fit. */
function leafLabel(p: Polygon, pole: XY, label: MapLabel, s: number): Placed | null {
  const across = chord(p, pole[1]);
  if (!across) return null;
  const room = 2 * Math.min(pole[0] - across[0], across[1] - pole[0]);
  const narrowest = narrowestWidth(label, true);
  for (const share of WIDTHS) {
    const width = (room * share) / s;
    if (width < narrowest) continue;
    const lines = linesIn(label, width);
    const h = labelHeight(lines) * s;
    const box = { x: pole[0] - (width * s) / 2, y: pole[1] - h / 2, w: width * s, h };
    if (holds(p, box)) return { lines, label: box, cut: bounds(p).y };
  }
  return null;
}

/** How far down a cell a parent's header may start, as shares of the cell's height. */
const HEADER_TOPS = [0.02, 0.05, 0.08, 0.12, 0.16, 0.2, 0.25];

/**
 * A parent's label at a scale, in a header at the top of its cell: the highest place where the
 * label, as wide as the cell allows there, fits, with its children's outline cut below it, leaving
 * them at least MIN_CHILD_SHARE of the cell. Null when it does not fit.
 */
function headerLabel(p: Polygon, label: MapLabel, s: number, pad: number): Placed | null {
  const box = bounds(p);
  const whole = polygonArea(p);
  const narrowest = narrowestWidth(label, true);
  for (const top of HEADER_TOPS) {
    const y0 = box.y + top * box.h;
    const first = chord(p, y0);
    if (!first) continue;
    let lines = linesIn(label, (first[1] - first[0]) / s);
    for (const share of WIDTHS) {
      // The room across is the narrower end of the header's band (a convex cell is narrowest at one end).
      const h = labelHeight(lines) * s;
      const end = chord(p, y0 + h);
      if (!end) break;
      const left = Math.max(first[0], end[0]);
      const right = Math.min(first[1], end[1]);
      const width = ((right - left) * share) / s;
      if (width < narrowest) continue;
      lines = linesIn(label, width);
      const lh = labelHeight(lines) * s;
      const rect = { x: (left + right) / 2 - (width * s) / 2, y: y0, w: width * s, h: lh };
      const cut = y0 + lh + pad;
      if (holds(p, rect) && polygonArea(below(p, cut)) >= MIN_CHILD_SHARE * whole) return { lines, label: rect, cut };
    }
  }
  return null;
}

/** A cell as its label is placed in it: its outline, its largest inscribed point (a leaf's), and its padding (a parent's). */
interface Room { polygon: Polygon; pole: XY | null; pad: number }

const placeAt = (room: Room, label: MapLabel, s: number): Placed | null =>
  room.polygon.length < 3 || s <= 0 ? null : room.pole ? leafLabel(room.polygon, room.pole, label, s) : headerLabel(room.polygon, label, s, room.pad);

/** The largest scale, at most `most`, at which a cell's label is placed, found by halving; 0 for a degenerate cell. */
function largestPlaced(room: Room, label: MapLabel, most: number): number {
  if (placeAt(room, label, most)) return most;
  let lo = 0;
  let hi = most;
  for (let round = 0; round < FIT_ROUNDS; round++) {
    const mid = (lo + hi) / 2;
    if (placeAt(room, label, mid)) lo = mid; else hi = mid;
  }
  return lo;
}

/**
 * Siblings' labels at one shared scale (LA-EXP-DR58): the largest at which every sibling's fits its
 * cell, no more than their size's (the smallest sibling's); stepped down a little more if one
 * sibling's does not fit at it, as a cell's room is not quite monotone in the scale.
 */
function shareLabels(rooms: readonly Room[], labels: readonly MapLabel[]): { text: number; placed: (Placed | null)[] } {
  const live = rooms.map((_, i) => i).filter((i) => rooms[i].polygon.length >= 3);
  const most = Math.min(...live.map((i) => cellText(rooms[i].polygon)));
  let text = Math.min(...live.map((i) => largestPlaced(rooms[i], labels[i], most)));
  if (!Number.isFinite(text)) return { text: 0, placed: rooms.map(() => null) };
  for (let step = 0; step <= STEPS_DOWN; step++, text *= STEP_DOWN) {
    const placed = rooms.map((r, i) => placeAt(r, labels[i], text));
    if (live.every((i) => placed[i])) return { text, placed };
  }
  return { text, placed: rooms.map((r, i) => placeAt(r, labels[i], text)) };
}

// ---------- The layout ----------

/** A small, fast seeded random number generator (mulberry32), so the library's jitter is the same every time. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A string's hash (FNV-1a). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

interface Site { id: string; weight: number }
/** Where the first child's seed is on its parent's circle: the upper left. */
const SEED_ANGLE = (-3 * Math.PI) / 4;

/**
 * The equal-area cells of some children in their parent's outline (exported for tests): a power
 * diagram, iterated until the cells' areas match. The children start evenly round a circle about
 * the outline's largest inscribed point, in the tree's order clockwise from the upper left, each
 * nudged by its ID.
 */
export function voronoiCells(outline: Polygon, ids: readonly string[]): Map<string, XY[]> {
  const cells = new Map<string, XY[]>();
  if (ids.length === 0 || outline.length < 3) return cells;
  if (ids.length === 1) { cells.set(ids[0], [...outline]); return cells; }
  // Laid out in the outline's own frame, its bounding box from (0, 0) to 1 across, rounded: the
  // same shape anywhere in the map, at any size, gives exactly the same cells.
  const box = bounds(outline);
  const size = Math.max(box.w, box.h) || 1;
  const clip: XY[] = outline.map(([x, y]) => [Math.round(((x - box.x) / size) * 1e9) / 1e9, Math.round(((y - box.y) / size) * 1e9) / 1e9]);
  const area = polygonArea(clip);
  const pole = polylabel([clip], Math.sqrt(area) / 100);
  const radius = pole.distance / 2;
  const sites: Site[] = ids.map((id) => ({ id, weight: 1 }));
  const seeds = new Map(ids.map((id, i) => {
    const angle = SEED_ANGLE + (2 * Math.PI * (i + 0.5)) / ids.length;
    const nudge = ((hash(id) % 1000) / 1000 - 0.5) * 1e-3 * radius;
    return [id, [pole[0] + Math.cos(angle) * (radius + nudge), pole[1] + Math.sin(angle) * (radius + nudge)] as XY] as const;
  }));
  const simulation = voronoiMapSimulation(sites)
    .weight((d) => d.weight)
    .clip(clip)
    .convergenceRatio(CONVERGENCE)
    .maxIterationCount(MAX_ROUNDS)
    .prng(seeded(hash(ids.join(' '))))
    .initialPosition((d) => seeds.get(d.id)!)
    .stop();
  // The library may give up on a degenerate round; the last good one stands.
  let good: VoronoiMapPolygon<Site>[] = [];
  try {
    for (let state = simulation.state(); ; state = simulation.state()) {
      good = state.polygons;
      if (state.ended) break;
      simulation.tick();
    }
  } catch { /* keep the last good round */ }
  for (const polygon of good) cells.set(polygon.site.originalObject.data.originalData.id, polygon.map(([x, y]) => [box.x + x * size, box.y + y * size] as XY));
  return cells;
}

/**
 * Lays out a tree given by its roots, a children function and, for each node, its label (its ID
 * when not given) as nested polygon cells (exported for tests).
 */
export function layoutVoronoi(
  roots: readonly string[],
  childrenOf: (id: string) => readonly string[],
  labelOf: (id: string) => MapLabel = (id) => ({ title: id, meta: '' }),
): VoronoiMap {
  const parent = new Map<string, string | null>();
  const level = new Map<string, number>();
  const kids = new Map<string, string[]>();
  const treeOrder = new Map<string, number>();
  const visit = (id: string, up: string | null, l: number) => {
    parent.set(id, up);
    level.set(id, l);
    treeOrder.set(id, treeOrder.size);
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

  const world = top.length === 0 ? [] : hexagon(PRODUCT_AREA);
  const polygons = new Map<string, XY[]>();
  const split = (clip: Polygon, ids: readonly string[], gap: number) => {
    const cells = voronoiCells(clip, ids);
    // Each cell is inset by half the gap, or less for a cell too small for it, so a gap never eats a small cell.
    for (const id of ids) {
      const cell = cells.get(id) ?? [];
      polygons.set(id, inset(cell, Math.min(gap, CELL_GAP * cellText(cell)) / 2));
    }
  };
  if (top.length === 1) polygons.set(top[0], world);
  else split(world, top, CELL_GAP * 4 * cellText(world));

  // From the roots down, a group of siblings at a time: their shared text and labels, then each one's children in its outline below its label.
  const nodes = new Map<string, VoronoiNode>();
  const byLevelIds: string[][] = [];
  const groups: string[][] = top.length > 0 ? [top] : [];
  for (let g = 0; g < groups.length; g++) {
    const ids = groups[g];
    const labels = ids.map((id) => labelOf(id));
    const rooms: Room[] = ids.map((id) => {
      const polygon = polygons.get(id)!;
      const leaf = kids.get(id)!.length === 0;
      const pole = leaf && polygon.length >= 3 ? (polylabel([polygon as XY[]], Math.max(1e-3, Math.sqrt(polygonArea(polygon)) / 200)) as unknown as XY) : null;
      return { polygon, pole, pad: CELL_PAD * (polygon.length >= 3 ? cellText(polygon) : 0) };
    });
    const { text, placed } = shareLabels(rooms, labels);
    ids.forEach((id, i) => {
      const own = kids.get(id)!;
      const { polygon, pad } = rooms[i];
      const box = polygon.length >= 3 ? bounds(polygon) : { x: 0, y: 0, w: 0, h: 0 };
      const at = placed[i];
      const l = level.get(id)!;
      nodes.set(id, {
        id, parent: parent.get(id)!, children: own, level: l, ...box, text,
        polygon, lines: at?.lines ?? linesIn(labels[i], Infinity), centered: true,
        label: at?.label ?? { x: box.x, y: box.y, w: 0, h: 0 }, cut: at?.cut ?? box.y, order: treeOrder.get(id)!,
      });
      (byLevelIds[l] ??= []).push(id);
      if (own.length === 0) return;
      const room = at ? below(inset(polygon, pad), at.cut) : inset(polygon, pad);
      split(room.length >= 3 ? room : polygon, own, CELL_GAP * cellText(polygon));
      groups.push(own);
    });
  }

  return {
    view: 'voronoi',
    nodes,
    roots: top,
    byLevel: byLevelIds.map((ids) => ids.map((id) => nodes.get(id)!).sort((a, b) => a.order - b.order)),
    width: world.length ? bounds(world).w : 0,
    height: world.length ? bounds(world).h : 0,
  };
}

/** What a layout reads of one product's tree: each node's children and label, from its root, a parent before its children. */
export interface VoronoiTree { root: string; nodes: { id: string; children: string[]; label: MapLabel }[] }

/** The tree under a root as the layout reads it, and a key that changes only when it does. */
export function voronoiTree(index: SpecIndex, root: string): { tree: VoronoiTree; key: string } {
  const nodes: VoronoiTree['nodes'] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    seen.add(id);
    const children = treeChildren(index, id).filter((c) => !seen.has(c));
    for (const c of children) seen.add(c);
    nodes.push({ id, children, label: mapLabel(index, id) });
    for (const c of children) walk(c);
  };
  walk(root);
  return { tree: { root, nodes }, key: JSON.stringify(nodes) };
}

/** Lays out a tree read by `voronoiTree`: what the worker runs. */
export function layoutTreeOf(tree: VoronoiTree): VoronoiMap {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  return layoutVoronoi([tree.root], (id) => byId.get(id)?.children ?? [], (id) => byId.get(id)?.label ?? { title: id, meta: '' });
}

const cache = new WeakMap<SpecIndex, Map<string, VoronoiMap>>();
const pending = new WeakMap<SpecIndex, Map<string, Promise<VoronoiMap>>>();
/** Each product's last layout this session, with the tree and measure it was built from: a spec loaded again with the same tree and labels (only a body changed, say) reuses it. */
const last = new Map<string, { key: string; map: VoronoiMap }>();

/** Whether this page can lay out in a worker; where it cannot (the tests, in jsdom), the layout runs at once on the main thread. */
const canWork = () => typeof Worker !== 'undefined';

let worker: Worker | null = null;
let asked = 0;
const waiting = new Map<number, { resolve: (map: VoronoiMap) => void; reject: (error: unknown) => void }>();
/** Lays out a tree in the worker (voronoi.worker.ts), started on first use, measuring its text as `measure` says; a worker that fails is dropped, and the next layout starts another. */
function inWorker(tree: VoronoiTree, measure: MeasureSpec): Promise<VoronoiMap> {
  if (!worker) {
    const started = new Worker(new URL('./voronoi.worker.ts', import.meta.url), { type: 'module' });
    started.onmessage = (e: MessageEvent<{ id: number; map: VoronoiMap }>) => { waiting.get(e.data.id)?.resolve(e.data.map); waiting.delete(e.data.id); };
    started.onerror = (e) => { for (const w of waiting.values()) w.reject(e); waiting.clear(); started.terminate(); worker = null; };
    worker = started;
  }
  const id = ++asked;
  const to = worker;
  return new Promise((resolve, reject) => { waiting.set(id, { resolve, reject }); to.postMessage({ id, tree, measure }); });
}

const mapsOf = (index: SpecIndex) => {
  let maps = cache.get(index);
  if (!maps) { maps = new Map(); cache.set(index, maps); }
  return maps;
};

/**
 * The Voronoi map of one product (or of a tree no product reaches), from its root, as the Tree map
 * has it (`mapRootOf`), if it is ready: laid out once per index and text measure, then read. A
 * spec loaded again with the same tree and labels gets the map it had at once. Where there is no
 * worker it is laid out here and now, so it is always ready.
 */
export function readyVoronoiMap(index: SpecIndex, root: string): VoronoiMap | undefined {
  const maps = mapsOf(index);
  const at = `${textMeasure().key}|${root}`;
  const known = maps.get(at);
  if (known) return known;
  const { tree, key } = voronoiTree(index, root);
  const before = last.get(at);
  let map = before && before.key === key ? before.map : undefined;
  if (!map && !canWork()) { map = layoutTreeOf(tree); last.set(at, { key, map }); }
  if (map) maps.set(at, map);
  return map;
}

/** The Voronoi map of one product, laid out in the worker, off the main thread, the first time an index asks for it; `measure` tells the worker the faces the page measures with. */
export function voronoiMap(index: SpecIndex, root: string, measure: MeasureSpec): Promise<VoronoiMap> {
  const ready = readyVoronoiMap(index, root);
  if (ready) return Promise.resolve(ready);
  let waits = pending.get(index);
  if (!waits) { waits = new Map(); pending.set(index, waits); }
  const at = `${textMeasure().key}|${root}`;
  const known = waits.get(at);
  if (known) return known;
  const { tree, key } = voronoiTree(index, root);
  const promise = inWorker(tree, measure).then((map) => {
    last.set(at, { key, map });
    mapsOf(index).set(at, map);
    return map;
  }).finally(() => waits.delete(at));
  waits.set(at, promise);
  return promise;
}
