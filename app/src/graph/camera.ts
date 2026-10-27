import type { GraphMap, MapNode, PlacedMap } from './map';
import { heightOf, widthOf, type Point } from './layout';

// The camera over the one map (LA-EXP-DS09). Focusing a node, by a click, the address, Back and
// Forward, the step keys or the trail, moves the camera only: it frames the focus and the levels
// the depth shows below it, with the parent's level kept at the left edge for context, in one
// smooth zoom and pan (a van Wijk and Nuij path, as d3's zoom uses). Nothing in the map moves or
// changes size. What is drawn is chosen by the level of detail (LA-EXP-DS10): only what is in
// view and big enough to see, each box with its label, and never more than a budget.
//
// The map's deepest boxes are very small against its product's box (map.ts), so a viewport is
// kept in doubles and a map point's place on screen is `x * zoom + v.x`, worked out in doubles
// relative to the camera: a renderer draws those small numbers, never map units scaled on the
// graphics card, so a deep zoom does not jitter.

export interface Viewport { x: number; y: number; zoom: number }

/** The space kept around the framed picture, in screen pixels. */
export const FRAME_PADDING = 32;
/** How much of the pane the parent's level keeps at the left edge, at most. */
export const PARENT_STRIP = 0.12;
export const PARENT_STRIP_MAX = 96;
/** The least share of the zoom the width allows that taking in whole rows may leave the focus (frameOnMap). */
export const ROWS_KEEP = 0.8;
/**
 * The most the camera zooms in (LA-EXP-DS09): enough to frame the deepest leaf of a large product's
 * map and read its label, which is very small against the product's box (map.ts).
 */
export const MAX_ZOOM = 64;
/** The least the camera zooms out: the whole of any product's map in a phone's pane. */
export const MIN_ZOOM = 1e-4;

/**
 * The camera that frames a focus (LA-EXP-DS09): the focus and its descendants down to `depth`
 * levels below it fill the pane, the parent's level showing in a strip at the left edge (the frame
 * starts at the parent's right edge, past the strip). A node with fewer levels below it frames what
 * it has. Zoomed in no further than MAX_ZOOM.
 *
 * No box of the framed levels is cut at an edge. Top and bottom, the frame takes whole rows of the
 * focus's level, the focus and as many of its neighbors as the width leaves room for, its edges in
 * the gaps between rows (or the padding past the first and last row); every deeper box lies inside
 * a box of the focus's level, so it is whole too. On the right, the frame ends in the gap before the
 * first box past the framed ones in the rows taken (or the padding past the last), and takes in any box it would cut;
 * what width is left over goes to the parent's strip on the left.
 */
export function frameOnMap(map: GraphMap, focus: string, depth: number, width: number, height: number): Viewport {
  const node = map.nodes.get(focus);
  if (!node || width <= 0 || height <= 0) return { x: width / 2, y: height / 2, zoom: 1 };
  // The framed boxes: the focus and its descendants down to `depth` levels below it.
  let framedRight = node.x + node.w;
  const walk = (n: MapNode, d: number) => {
    framedRight = Math.max(framedRight, n.x + n.w);
    if (d >= depth) return;
    for (const c of n.children) walk(map.nodes.get(c)!, d + 1);
  };
  walk(node, 0);
  const subtree = (n: MapNode): MapNode[] => [n, ...n.children.flatMap((c) => subtree(map.nodes.get(c)!))];
  // Where the frame ends on the right, among some boxes in view: in the middle of the gap before the first box past
  // the framed ones (with no padding), or past the framed ones with the padding; a box it would cut is taken in.
  const rightEdge = (shown: readonly MapNode[]) => {
    let edge = framedRight;
    for (let pass = 0; pass < shown.length + 1; pass++) {
      const beyond = shown.filter((n) => n.x >= edge).map((n) => n.x);
      const at = beyond.length > 0 ? (edge + Math.min(...beyond)) / 2 : edge;
      const cut = shown.filter((n) => n.x < at && n.x + n.w > at);
      if (cut.length === 0) return { right: at, pad: beyond.length > 0 ? 0 : FRAME_PADDING };
      edge = Math.max(...cut.map((n) => n.x + n.w));
    }
    return { right: edge, pad: FRAME_PADDING };
  };
  // From the parent's right edge (the gap to the focus included), or the focus's left edge for a root.
  const parent = node.parent === null ? null : map.nodes.get(node.parent)!;
  const left = parent ? parent.x + parent.w : node.x;
  const strip = parent ? Math.min(PARENT_STRIP_MAX, width * PARENT_STRIP) : 0;
  const zoomFor = (edge: { right: number; pad: number }) => Math.min(MAX_ZOOM, (width - strip - FRAME_PADDING - edge.pad) / (edge.right - left));
  const widthZoom = zoomFor(rightEdge(subtree(node)));

  // The rows of the focus's level the frame takes, from row i to row j, and the zoom that fits them.
  const row = map.byLevel[node.level];
  let i = row.indexOf(node);
  let j = i;
  // The margin past a row: half the gap to the next row, at most half a sibling gap (a twentieth of the row), so a
  // wide gap to a cousin far away is not framed.
  const margin = (gap: number, h: number) => Math.min(gap / 2, h / 20);
  const rows = () => {
    const top = i > 0 ? row[i].y - margin(row[i].y - (row[i - 1].y + row[i - 1].h), row[i].h) : row[i].y;
    const bottom = j < row.length - 1 ? row[j].y + row[j].h + margin(row[j + 1].y - (row[j].y + row[j].h), row[j].h) : row[j].y + row[j].h;
    const topPad = i > 0 ? 0 : FRAME_PADDING;
    const pads = topPad + (j < row.length - 1 ? 0 : FRAME_PADDING);
    return { top, topPad, zoom: (height - pads) / (bottom - top) };
  };
  let frame = rows();
  // Take in a sibling at a time, above and below in turn, until the rows fit the width's zoom. Only siblings: a
  // cousin may be far taller, and framing it would shrink the focus. A sibling that would take the zoom below
  // ROWS_KEEP of the width's is left out (the frame then centers on the rows it has): framing whole rows never costs
  // the focus much of its size on screen.
  const sibling = (k: number) => k >= 0 && k < row.length && row[k].parent === node.parent;
  for (let up = true; frame.zoom > widthZoom && (sibling(i - 1) || sibling(j + 1)); up = !up) {
    const [was, wasI, wasJ] = [frame, i, j];
    if ((up && sibling(i - 1)) || !sibling(j + 1)) i--;
    else j++;
    frame = rows();
    if (frame.zoom < ROWS_KEEP * widthZoom) { [frame, i, j] = [was, wasI, wasJ]; break; }
  }
  // The right edge for every row taken (a sibling's own column may reach further than the focus's).
  const edge = rightEdge(row.slice(i, j + 1).flatMap(subtree));
  const zoom = Math.min(zoomFor(edge), frame.zoom);
  // Rows that fit at the width's zoom fill the height; rows narrower than the pane are centered on their middle.
  const y = frame.zoom <= zoom ? frame.topPad - frame.top * zoom : height / 2 - (row[i].y + (row[j].y + row[j].h)) / 2 * zoom;
  return { x: width - edge.pad - edge.right * zoom, y, zoom };
}

/** The whole map in the pane: the overview's camera, and the least the camera zooms out. */
export function frameMap(map: GraphMap, width: number, height: number): Viewport {
  const zoom = Math.min(MAX_ZOOM, (width - 2 * FRAME_PADDING) / Math.max(1, map.width), (height - 2 * FRAME_PADDING) / Math.max(1, map.height));
  return { x: width / 2 - (map.width / 2) * zoom, y: height / 2 - (map.height / 2) * zoom, zoom };
}

/** The viewport that fits some boxes in a pane, centered, never zoomed in past 1 (a trace's camera). */
export function fitBoxes(positions: ReadonlyMap<string, Point>, width: number, height: number, padding = 40, heights?: ReadonlyMap<string, number>, widths?: ReadonlyMap<string, number>): Viewport {
  const all = [...positions];
  if (all.length === 0) return { x: width / 2, y: height / 2, zoom: 1 };
  const minX = Math.min(...all.map(([, p]) => p.x));
  const minY = Math.min(...all.map(([, p]) => p.y));
  const maxX = Math.max(...all.map(([id, p]) => p.x + widthOf(widths, id)));
  const maxY = Math.max(...all.map(([id, p]) => p.y + heightOf(heights, id)));
  const zoom = Math.max(0.1, Math.min(1, (width - 2 * padding) / (maxX - minX), (height - 2 * padding) / (maxY - minY)));
  return { x: width / 2 - ((minX + maxX) / 2) * zoom, y: height / 2 - ((minY + maxY) / 2) * zoom, zoom };
}

// ---------- The glide ----------

/** A view as its center in the world and its size in world units: what the zoom path moves. */
type View = [cx: number, cy: number, size: number];
const toView = (v: Viewport, w: number, h: number): View => [(w / 2 - v.x) / v.zoom, (h / 2 - v.y) / v.zoom, Math.max(w, h) / v.zoom];
const fromView = ([cx, cy, size]: View, w: number, h: number): Viewport => {
  const zoom = Math.max(w, h) / size;
  return { x: w / 2 - cx * zoom, y: h / 2 - cy * zoom, zoom };
};

const RHO = Math.SQRT2;

/**
 * The smooth zoom and pan between two viewports (van Wijk and Nuij, "Smooth and efficient zooming
 * and panning", the path d3-zoom takes): it zooms out as far as the pan needs, then in. Returns the
 * viewport at progress t (0 to 1) and the path's length, `S`, in its own units.
 */
export function zoomPath(from: Viewport, to: Viewport, width: number, height: number): { at: (t: number) => Viewport; S: number } {
  const [ux0, uy0, w0] = toView(from, width, height);
  const [ux1, uy1, w1] = toView(to, width, height);
  const dx = ux1 - ux0;
  const dy = uy1 - uy0;
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-12) {
    const S = Math.log(w1 / w0) / RHO;
    return { S: Math.abs(S), at: (t) => (t >= 1 ? to : fromView([ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(RHO * t * S)], width, height)) };
  }
  const d1 = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + RHO ** 4 * d2) / (2 * w0 * RHO ** 2 * d1);
  const b1 = (w1 * w1 - w0 * w0 - RHO ** 4 * d2) / (2 * w1 * RHO ** 2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / RHO;
  return {
    S,
    at: (t) => {
      if (t >= 1) return to;
      if (t <= 0) return from;
      const s = t * S;
      const u = (w0 / (RHO ** 2 * d1)) * (Math.cosh(r0) * Math.tanh(RHO * s + r0) - Math.sinh(r0));
      return fromView([ux0 + u * dx, uy0 + u * dy, (w0 * Math.cosh(r0)) / Math.cosh(RHO * s + r0)], width, height);
    },
  };
}

/** How long a glide takes: the shared motion's duration for a short path, up to twice it for a long one. */
export const glideDuration = (speed: number, S: number) => speed * Math.min(2, Math.max(1, S / 1.5));

// ---------- Level of detail ----------

/** A node too small to see on screen (in pixels) is not drawn: its parent draws a bar for it and its siblings that are as small. */
export const MIN_DRAWN = 3;
/** The most boxes a picture draws (LA-PAT-APP-UX-R11): a level that would pass it is drawn as bars. */
export const MAX_DRAWN = 260;

/** A drawn box, always with its label (LA-EXP-DS10), its text's size the map's (MapNode.text), never the camera's. */
export interface DrawnBox { id: string }
/** A bar standing for some children too small to draw (or past the budget): in their level, from the first's top to the last's bottom. */
/** A run of a parent's children too small to draw, as one bar where they are: their column's left edge and width, and their stack's top and height. */
export interface DrawnBar { id: string; parent: string; x: number; y: number; w: number; h: number }
export interface Drawn { boxes: DrawnBox[]; bars: DrawnBar[] }

/** The world rectangle a viewport shows, with a margin of a tenth each way. */
export function viewRect(v: Viewport, width: number, height: number) {
  const mx = (width * 0.1) / v.zoom;
  const my = (height * 0.1) / v.zoom;
  return { x0: -v.x / v.zoom - mx, y0: -v.y / v.zoom - my, x1: (width - v.x) / v.zoom + mx, y1: (height - v.y) / v.zoom + my };
}

/**
 * What a viewport draws of the map (LA-EXP-DS10), level by level from the roots: a node in view
 * and at least MIN_DRAWN pixels tall is drawn, with its label. A run of drawn parent's children too small to see is one bar.
 * A level that would take the boxes past MAX_DRAWN is drawn as one bar per parent instead, and
 * nothing below it. `always` adds nodes drawn whatever their size or place (the focus, linked
 * records). The same viewport always draws the same.
 */
export function drawnFor(map: GraphMap, v: Viewport, width: number, height: number, always: Iterable<string> = []): Drawn {
  const rect = viewRect(v, width, height);
  const z = v.zoom;
  const boxes: DrawnBox[] = [];
  const bars: DrawnBar[] = [];
  const drawn = new Set<string>();
  const inY = (n: MapNode) => n.y + n.h >= rect.y0 && n.y <= rect.y1;
  const inX = (n: MapNode) => n.x + n.w >= rect.x0 && n.x <= rect.x1;
  const box = (n: MapNode): DrawnBox => ({ id: n.id });
  /** The bars for a parent's children too small to draw, one per run of them. */
  const barsOf = (p: MapNode, small: (c: MapNode) => boolean) => {
    let run: MapNode[] = [];
    const flush = () => {
      if (run.length === 0) return;
      const first = run[0];
      const last = run[run.length - 1];
      bars.push({ id: `bar:${p.id}:${first.id}:${last.id}`, parent: p.id, x: first.x, y: first.y, w: first.w, h: last.y + last.h - first.y });
      run = [];
    };
    for (const id of p.children) {
      const c = map.nodes.get(id)!;
      if (small(c)) run.push(c); else flush();
    }
    flush();
  };

  // Each level's nodes in view, from the parents of the level before that are in view (drawn or not).
  let open: MapNode[] = map.roots.map((id) => map.nodes.get(id)!).filter(inY);
  while (open.length > 0) {
    const big = open.filter((n) => n.h * z >= MIN_DRAWN);
    const shown = big.filter(inX);
    if (boxes.length + shown.length > MAX_DRAWN) {
      // Past the budget: each drawn parent shows its children in this level as one bar.
      const parents = new Set(shown.map((n) => n.parent).filter((p): p is string => p !== null && drawn.has(p)));
      for (const p of parents) barsOf(map.nodes.get(p)!, () => true);
      break;
    }
    for (const n of shown) { boxes.push(box(n)); drawn.add(n.id); }
    const next: MapNode[] = [];
    for (const n of big) {
      if (n.children.length === 0) continue;
      const kids = n.children.map((id) => map.nodes.get(id)!);
      if (drawn.has(n.id) && kids.some((c) => c.h * z < MIN_DRAWN) && inX(kids[0])) barsOf(n, (c) => c.h * z < MIN_DRAWN);
      for (const c of kids) if (c.h * z >= MIN_DRAWN && inY(c)) next.push(c);
    }
    open = next;
  }
  for (const id of always) {
    const n = map.nodes.get(id);
    if (n && !drawn.has(id)) { boxes.push(box(n)); drawn.add(id); }
  }
  return { boxes, bars };
}

/** Several pictures as one: every box in any, and every bar. */
export function mergeDrawn(pictures: readonly Drawn[]): Drawn {
  const boxes = new Map<string, DrawnBox>();
  for (const p of pictures) for (const b of p.boxes) boxes.set(b.id, b);
  const bars = new Map<string, DrawnBar>();
  for (const p of pictures) for (const b of p.bars) bars.set(b.id, b);
  return { boxes: [...boxes.values()], bars: [...bars.values()] };
}

/** A key that changes only when what is drawn changes. */
export const drawnKey = (d: Drawn) => `${d.boxes.map((b) => b.id).join(' ')}|${d.bars.map((b) => b.id).join(' ')}`;

// ---------- The Nested view (LA-EXP-DS09) ----------

/** The camera that frames a focus in the Nested map: its box fills the pane within the padding, centered, zoomed in no further than MAX_ZOOM. */
export function frameNested(map: PlacedMap, focus: string, width: number, height: number): Viewport {
  const node = map.nodes.get(focus);
  if (!node || width <= 0 || height <= 0) return { x: width / 2, y: height / 2, zoom: 1 };
  const zoom = Math.min(MAX_ZOOM, (width - 2 * FRAME_PADDING) / Math.max(1, node.w), (height - 2 * FRAME_PADDING) / Math.max(1, node.h));
  return { x: width / 2 - (node.x + node.w / 2) * zoom, y: height / 2 - (node.y + node.h / 2) * zoom, zoom };
}

/**
 * What a viewport draws of the Nested map (LA-EXP-DS09), level by level from the roots, a parent
 * before its children so each child is drawn over its parent: a box in view and at least MIN_DRAWN
 * pixels each way on screen is drawn, with its label. A level that would take the drawing past
 * MAX_DRAWN is not drawn, nor anything below it: its parents stand for it, so there are no bars.
 * `always` adds boxes drawn whatever their size or place.
 */
export function drawnNested(map: PlacedMap, v: Viewport, width: number, height: number, always: Iterable<string> = []): Drawn {
  const rect = viewRect(v, width, height);
  const z = v.zoom;
  const box = (n: MapNode): DrawnBox => ({ id: n.id });
  const seen = (n: MapNode) => n.x + n.w >= rect.x0 && n.x <= rect.x1 && n.y + n.h >= rect.y0 && n.y <= rect.y1 && n.w * z >= MIN_DRAWN && n.h * z >= MIN_DRAWN;
  const boxes: DrawnBox[] = [];
  const drawn = new Set<string>();
  let open: MapNode[] = map.roots.map((id) => map.nodes.get(id)!).filter(seen);
  while (open.length > 0 && boxes.length + open.length <= MAX_DRAWN) {
    for (const n of open) { boxes.push(box(n)); drawn.add(n.id); }
    open = open.flatMap((n) => n.children.map((c) => map.nodes.get(c)!).filter(seen));
  }
  for (const id of always) {
    const n = map.nodes.get(id);
    if (n && !drawn.has(id)) { boxes.push(box(n)); drawn.add(id); }
  }
  return { boxes, bars: [] };
}
