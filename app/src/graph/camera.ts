import type { GraphMap, MapNode } from './map';
import { heightOf, widthOf, type Point } from './layout';
import { labelShown, MIN_LABEL_PX, TITLE_FONT } from './text';

// The camera over the one map (LA-EXP-DR59). Focusing a node, by a click, the address, Back and
// Forward, the step keys or the trail, moves the camera only: it frames the focus and the levels
// the depth shows below it, with the parent's level kept at the left edge for context, in one
// smooth zoom and pan (a van Wijk and Nuij path, as d3's zoom uses). Nothing in the map moves or
// changes size. What is drawn is chosen by the level of detail (LA-EXP-DR60): only what is in
// view and big enough to see, labels only where they can be read, and never more than a budget.

export interface Viewport { x: number; y: number; zoom: number }

/** The space kept around the framed picture, in screen pixels. */
export const FRAME_PADDING = 32;
/** How much of the pane the parent's level keeps at the left edge, at most. */
export const PARENT_STRIP = 0.12;
export const PARENT_STRIP_MAX = 96;
/** The camera's zoom limits: far enough out for the whole map, never past twice a leaf's size. */
export const MAX_ZOOM = 2;
/** The camera never zooms in past this when it frames a focus: a leaf at its own size. */
export const FRAME_MAX_ZOOM = 1;

/**
 * The camera that frames a focus (LA-EXP-DR59): the focus and its descendants down to `depth`
 * levels below it fill the pane, the parent's level showing in a strip at the left edge (the frame
 * starts at the parent's right edge, past the strip). A node with fewer levels below it frames what
 * it has. Zoomed in no further than FRAME_MAX_ZOOM, and centered in the space right of the strip.
 * Never zoomed out so far that the focus's own title is under MIN_LABEL_PX on screen: in a narrow
 * pane, deep levels may then run past its right edge, the frame starting at the strip, and are
 * reached by panning.
 */
export function frameOnMap(map: GraphMap, focus: string, depth: number, width: number, height: number): Viewport {
  const node = map.nodes.get(focus);
  if (!node || width <= 0 || height <= 0) return { x: width / 2, y: height / 2, zoom: 1 };
  let deepest = node.level;
  const walk = (n: MapNode, d: number) => {
    if (n.level > deepest) deepest = n.level;
    if (d >= depth) return;
    for (const c of n.children) walk(map.nodes.get(c)!, d + 1);
  };
  walk(node, 0);
  const last = map.levels[deepest];
  // From the parent's right edge (the gap to the focus included), or the focus's left edge for a root, to the last level's right edge.
  const parent = node.parent === null ? null : map.nodes.get(node.parent)!;
  const left = parent ? parent.x + parent.w : node.x;
  const right = last.x + last.width;
  const strip = parent ? Math.min(PARENT_STRIP_MAX, width * PARENT_STRIP) : 0;
  const room = { w: width - strip - 2 * FRAME_PADDING, h: height - 2 * FRAME_PADDING };
  const fits = room.w / (right - left);
  const readable = MIN_LABEL_PX / (TITLE_FONT * node.text);
  const zoom = Math.min(FRAME_MAX_ZOOM, room.h / node.h, Math.max(fits, readable));
  const cy = node.y + node.h / 2;
  const x = zoom <= fits ? strip + FRAME_PADDING + room.w / 2 - ((left + right) / 2) * zoom : strip + FRAME_PADDING - left * zoom;
  return { x, y: height / 2 - cy * zoom, zoom };
}

/** The whole map in the pane: the overview's camera, and the least the camera zooms out. */
export function frameMap(map: GraphMap, width: number, height: number): Viewport {
  const zoom = Math.min(FRAME_MAX_ZOOM, (width - 2 * FRAME_PADDING) / Math.max(1, map.width), (height - 2 * FRAME_PADDING) / Math.max(1, map.height));
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

/** A drawn box: labeled, or a plain filled box too small on screen for its text. Its text's size is the map's (MapNode.text), never the camera's. */
export interface DrawnBox { id: string; label: boolean }
/** A bar standing for some children too small to draw (or past the budget): in their level, from the first's top to the last's bottom. */
export interface DrawnBar { id: string; parent: string; level: number; y: number; h: number }
export interface Drawn { boxes: DrawnBox[]; bars: DrawnBar[] }

/** The world rectangle a viewport shows, with a margin of a tenth each way. */
export function viewRect(v: Viewport, width: number, height: number) {
  const mx = (width * 0.1) / v.zoom;
  const my = (height * 0.1) / v.zoom;
  return { x0: -v.x / v.zoom - mx, y0: -v.y / v.zoom - my, x1: (width - v.x) / v.zoom + mx, y1: (height - v.y) / v.zoom + my };
}

/**
 * What a viewport draws of the map (LA-EXP-DR60), level by level from the roots: a node in view
 * and at least MIN_DRAWN pixels tall is drawn, labeled when its title is at least MIN_LABEL_PX on
 * screen at this zoom (`labelShown`), plain otherwise. A run of drawn parent's children too small to see is one bar.
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
  const box = (n: MapNode): DrawnBox => ({ id: n.id, label: labelShown(n.text, z) });
  /** The bars for a parent's children too small to draw, one per run of them. */
  const barsOf = (p: MapNode, small: (c: MapNode) => boolean) => {
    let run: MapNode[] = [];
    const flush = () => {
      if (run.length === 0) return;
      const first = run[0];
      const last = run[run.length - 1];
      bars.push({ id: `bar:${p.id}:${first.id}:${last.id}`, parent: p.id, level: first.level, y: first.y, h: last.y + last.h - first.y });
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

/** Several pictures as one: every box in any, labeled as the last picture that has it labels it (the view the glide ends on), and every bar. */
export function mergeDrawn(pictures: readonly Drawn[]): Drawn {
  const boxes = new Map<string, DrawnBox>();
  for (const p of pictures) for (const b of p.boxes) boxes.set(b.id, b);
  const bars = new Map<string, DrawnBar>();
  for (const p of pictures) for (const b of p.bars) bars.set(b.id, b);
  return { boxes: [...boxes.values()], bars: [...bars.values()] };
}

/** A key that changes only when what is drawn changes. */
export const drawnKey = (d: Drawn) => `${d.boxes.map((b) => `${b.id}${b.label ? '+' : ''}`).join(' ')}|${d.bars.map((b) => b.id).join(' ')}`;
