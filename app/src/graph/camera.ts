import { type GraphMap, type MapNode, type PlacedMap } from './map';
import { FAR_TEXT, type GroundMap } from './ground';
import { LINE_HEIGHT, TITLE_FONT } from './text';

// The camera over the one map (LA-EXP-DS09). Focusing a node, by a click, the address, Back and
// Forward, the step keys or the trail, moves the camera only: it frames the focus to most of the open space's width
// (FOCUS_SHARE; in the Tree with its parent in a strip at the left edge and its children's column whole on the right), its children readable, the focused box whole
// (wholeIn, LA-PAT-APP-UX-R23), in one smooth zoom and pan (a van Wijk and Nuij path, as d3's zoom uses). Nothing in the map moves or
// changes size. What is drawn is chosen by the level of detail (LA-EXP-DS10): only what is in
// view and big enough to see, each box with its label, and never more than a budget; the focus and its direct children
// are always drawn whole, each child framed so its label reads (childZoom).
//
// The map's deepest boxes are very small against its product's box (map.ts), so a viewport is
// kept in doubles and a map point's place on screen is `x * zoom + v.x`, worked out in doubles
// relative to the camera: a renderer draws those small numbers, never map units scaled on the
// graphics card, so a deep zoom does not jitter.

export interface Viewport { x: number; y: number; zoom: number }

/** The space kept around the framed picture, in screen pixels. */
export const FRAME_PADDING = 32;
/** How much of the pane the parent's strip at the left edge takes, at most (frameOnMap). */
export const PARENT_STRIP = 0.12;
export const PARENT_STRIP_MAX = 96;
/**
 * The least the camera's zoom-in limit is (LA-EXP-DS09); a map whose smallest box needs more gets more (maxZoomFor).
 */
export const MAX_ZOOM = 256;
/** How tall, in CSS pixels, a map's smallest box may be drawn when zoomed in all the way. */
export const DEEPEST_PX = 400;

/**
 * The most the camera zooms in on a map (LA-EXP-DS09): enough to draw its smallest box DEEPEST_PX on its shorter side,
 * and never less than MAX_ZOOM, so however deep a product's map grows, its deepest leaf can be framed and read.
 */
export function maxZoomFor(map: { nodes: ReadonlyMap<string, { w: number; h: number }> }): number {
  let smallest = Infinity;
  for (const n of map.nodes.values()) smallest = Math.min(smallest, n.w, n.h);
  return Number.isFinite(smallest) && smallest > 0 ? Math.max(MAX_ZOOM, DEEPEST_PX / smallest) : MAX_ZOOM;
}
/** The least the camera zooms out: the whole of any product's map in a phone's pane. */
export const MIN_ZOOM = 1e-4;

/**
 * How much of the open space's width a focused box fills (LA-EXP-DS09) in the Nested view and the Map, and a leaf in the
 * Tree: most of it, the rest left for context (the parent's strip in the Tree).
 */
export const FOCUS_SHARE = 0.75;

/** The zoom that frames a box `w` by `h` to FOCUS_SHARE of the frame's width, whole: a tall box's height caps it (LA-PAT-APP-UX-R23). */
const shareZoom = (w: number, h: number, width: number, height: number, max: number) =>
  Math.min(max, (FOCUS_SHARE * width) / Math.max(1e-12, w), (height - 2 * FRAME_PADDING) / Math.max(1e-12, h));

/**
 * The size on screen, in CSS pixels, a focus's direct child's title reads at, at least (LA-V93-R77): a record's title
 * as the Map draws it at street level, at the page's own text size (TITLE_FONT at zoom 1). Under it a child draws its
 * title alone at this size, wrapped to two lines and cut with an ellipsis only past them (paint.ts wholeLabel).
 */
export const CHILD_TITLE_PX = TITLE_FONT;
/** The room, in CSS pixels, a child's whole label keeps from its box's sides and edges (paint.ts wholeLabel). */
export const CHILD_PAD_PX = 4;
/** The most a child's border takes on screen at that size, in CSS pixels, kept clear of its two lines. */
const CHILD_BORDER_PX = 2;
/**
 * The least size on screen, in CSS pixels, the camera frames a focus's direct children at (LA-EXP-DS09): tall enough for
 * two lines of a title at CHILD_TITLE_PX with their padding and its border, wide enough for a few words on each.
 */
export const CHILD_MIN_H = Math.ceil(2 * CHILD_TITLE_PX * LINE_HEIGHT + 2 * CHILD_PAD_PX + 2 * CHILD_BORDER_PX);
export const CHILD_MIN_W = 120;

/**
 * The least zoom at which every direct child of a node reads (LA-EXP-DS09): each at least CHILD_MIN_W by CHILD_MIN_H on
 * screen, and a Map's leaf record (one with a label from afar) also with that label at CHILD_TITLE_PX. 0 for a leaf.
 */
export function childZoom(map: PlacedMap, id: string): number {
  const node = map.nodes.get(id);
  let least = 0;
  for (const c of node?.children ?? []) {
    const child = map.nodes.get(c) as MapNode & { far?: unknown };
    if (!child) continue;
    least = Math.max(least, CHILD_MIN_W / Math.max(1e-12, child.w), CHILD_MIN_H / Math.max(1e-12, child.h));
    if (child.far) least = Math.max(least, CHILD_TITLE_PX / (FAR_TEXT * TITLE_FONT));
  }
  return least;
}

/** A node and its direct children's bounds, in map units: what the camera keeps whole with the focus (keptBox). */
function withChildren(map: PlacedMap, node: MapNode): MapRect {
  let [x0, y0, x1, y1] = [node.x, node.y, node.x + node.w, node.y + node.h];
  for (const c of node.children) {
    const child = map.nodes.get(c);
    if (!child) continue;
    x0 = Math.min(x0, child.x); y0 = Math.min(y0, child.y); x1 = Math.max(x1, child.x + child.w); y1 = Math.max(y1, child.y + child.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * The camera's offset along one side for a focus (`start`, `extent`, in map units) whose first child starts at `first`,
 * at `zoom` in a frame `size` pixels long: centered when it fits inside the padding, else from its start, so its first
 * children show; where its header would take more than a third of the frame (a big Nested parent), from its first child,
 * twice the padding in, the focus's name kept in the strip above it (its sticky label).
 */
function placeAlong(start: number, extent: number, zoom: number, size: number, first = start): number {
  if (extent * zoom <= size - 2 * FRAME_PADDING) return size / 2 - (start + extent / 2) * zoom;
  return (first - start) * zoom > size / 3 ? 2 * FRAME_PADDING - first * zoom : FRAME_PADDING - start * zoom;
}
/** Where a node's children start, across and down, in map units: its own corner for a leaf. */
function childrenStart(map: PlacedMap, node: MapNode): { x: number; y: number } {
  if (node.children.length === 0) return { x: node.x, y: node.y };
  let [x, y] = [Infinity, Infinity];
  for (const c of node.children) {
    const child = map.nodes.get(c);
    if (child) { x = Math.min(x, child.x); y = Math.min(y, child.y); }
  }
  return Number.isFinite(x) ? { x, y } : { x: node.x, y: node.y };
}

/**
 * The camera that frames a focus in the Tree (LA-EXP-DS09). A focus with children is framed with its children's
 * column: the focus as wide as the room their column and its parent's strip at the left edge (at most PARENT_STRIP of
 * the pane, PARENT_STRIP_MAX pixels) leave, whole and centered top to bottom (a tall box's height caps the zoom,
 * LA-PAT-APP-UX-R23), zoomed in no further than `max` (maxZoomFor), and at least as far as its children read
 * (childZoom). Where they cannot read with the focus whole (a node with many children, or on a phone), they win: the
 * camera zooms in until they read, its children's column at the right and their first ones at the top, the rest a pan
 * away; the focus shows as much as fits, at least FOCUS_SLIVER. A leaf fills FOCUS_SHARE of the pane's width, its parent's strip at the left.
 * Siblings above and below may be cut at the edges. The depth decides only how many levels are drawn (drawnFor), never
 * what is framed.
 */
export function frameOnMap(map: GraphMap, focus: string, width: number, height: number, max = MAX_ZOOM): Viewport {
  const node = map.nodes.get(focus);
  if (!node || width <= 0 || height <= 0) return { x: width / 2, y: height / 2, zoom: 1 };
  const parent = node.parent === null ? null : map.nodes.get(node.parent)!;
  const gap = parent ? node.x - (parent.x + parent.w) : 0;
  const strip = parent ? Math.min(PARENT_STRIP_MAX, width * PARENT_STRIP) : FRAME_PADDING;
  if (node.children.length === 0) {
    const zoom = shareZoom(node.w, node.h, width, height, max);
    const free = width - node.w * zoom;
    // Where the focus's left edge goes on screen: past the padding for a root, else past the parent's strip and the gap to it; whole on screen, whatever the gaps.
    let left = parent ? Math.max(0, Math.min(strip, free - gap * zoom)) + gap * zoom : FRAME_PADDING;
    left = Math.max(Math.min(FOCUS_CLEAR, free / 2), Math.min(left, free - Math.min(FOCUS_CLEAR, free / 2)));
    return { x: left - node.x * zoom, y: height / 2 - (node.y + node.h / 2) * zoom, zoom };
  }
  const all = withChildren(map, node);
  // From the parent's gap to the right of the children's column, in map units.
  const span = all.x + all.w - node.x + gap;
  const fits = Math.min(max, (width - FRAME_PADDING - strip) / Math.max(1e-12, span), (height - 2 * FRAME_PADDING) / Math.max(1e-12, node.h));
  const zoom = Math.max(fits, Math.min(max, childZoom(map, focus)));
  // The parent's strip and the focus with its column, when they fit; else the column at the right, the focus cut at the
  // left, at least FOCUS_SLIVER of it in view (the column's right edge may then be cut a little).
  const x = span * zoom <= width - FRAME_PADDING - strip
    ? strip + gap * zoom - node.x * zoom
    : Math.max(width - FOCUS_CLEAR - (all.x + all.w) * zoom, FOCUS_SLIVER - (node.x + node.w) * zoom);
  return { x, y: placeAlong(node.y, node.h, zoom, height), zoom };
}

/** The whole map in the pane: the overview's camera, and the least the camera zooms out. */
export function frameMap(map: GraphMap, width: number, height: number): Viewport {
  const zoom = Math.min(MAX_ZOOM, (width - 2 * FRAME_PADDING) / Math.max(1, map.width), (height - 2 * FRAME_PADDING) / Math.max(1, map.height));
  return { x: width / 2 - (map.width / 2) * zoom, y: height / 2 - (map.height / 2) * zoom, zoom };
}

/** A rectangle of a map, in map units. */
export interface MapRect { x: number; y: number; w: number; h: number }

/**
 * The camera that frames a rectangle of a stage's one map in a frame of the pane (LA-PAT-APP-UX-R19): a whole map (the
 * camera's Fit), an ERD's region. Zoomed in no further than `max` nor out past `min`, `pad` pixels kept around it: its
 * whole width, and its whole height unless that would zoom out past the width's zoom or `read`, whichever is less: then
 * from its top, so a tall region starts readable at its top edge and its overview is a zoom out away. A rectangle
 * narrower or shorter than the frame is centered in it.
 */
export function frameRect(rect: MapRect, frame: MapRect, { pad, read, max, min }: { pad: number; read: number; max: number; min: number }): Viewport {
  const w = Math.max(1, frame.w - 2 * pad);
  const h = Math.max(1, frame.h - 2 * pad);
  const tall = h / Math.max(1e-9, rect.h);
  const wide = w / Math.max(1e-9, rect.w);
  const zoom = Math.max(min, Math.min(max, Math.max(Math.min(tall, wide), Math.min(wide, read))));
  /** Along one side: centered when it fits, else from its start. */
  const along = (start: number, extent: number, room: number, from: number) => (extent * zoom <= room - 2 * pad ? from + room / 2 - (start + extent / 2) * zoom : from + pad - start * zoom);
  return { x: along(rect.x, rect.w, frame.w, frame.x), y: along(rect.y, rect.h, frame.h, frame.y), zoom };
}

/** How much of a focus cut at the left by its children's column stays in view, in screen pixels (frameOnMap). */
const FOCUS_SLIVER = 24;
/** The least room, in screen pixels, a focused box keeps from the frame's edges (wholeIn). */
export const FOCUS_CLEAR = 8;

/**
 * The focused box always whole (LA-PAT-APP-UX-R23): `v` as it is when `box` (in map units) lies wholly inside `frame`
 * (the open space less the stage's tools, in screen pixels) with `pad` to spare on every side; else moved as little as
 * it takes, zoomed out about the box's middle first, no further than `min`, when the box is too big to fit at `v`'s
 * zoom. Every stage's framing ends here, and so does the camera's follow of a moving box: never cut at an edge nor under
 * a panel, the wiki card, the toolbar, the key or the minimap.
 */
export function wholeIn(v: Viewport, box: MapRect, frame: MapRect, pad = FOCUS_CLEAR, min = MIN_ZOOM): Viewport {
  const room = (extent: number) => Math.max(1, extent - 2 * pad);
  const fit = Math.min(room(frame.w) / Math.max(1e-12, box.w), room(frame.h) / Math.max(1e-12, box.h));
  const zoom = fit < v.zoom ? Math.max(min, fit) : v.zoom;
  /** The camera's offset along one side: the box's middle where it was, then moved in as little as it takes. */
  const along = (offset: number, start: number, extent: number, from: number, size: number) => {
    const middle = (start + extent / 2) * v.zoom + offset;
    let at = middle - (extent / 2) * zoom;
    const span = extent * zoom;
    if (span > room(size)) at = from + pad;
    else at = Math.min(Math.max(at, from + pad), from + size - pad - span);
    return at - start * zoom;
  };
  return { x: along(v.x, box.x, box.w, frame.x, frame.w), y: along(v.y, box.y, box.h, frame.y, frame.h), zoom };
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

/**
 * A box whose title would be drawn smaller than this on screen, in CSS pixels, is drawn as a plain block, with no label,
 * icons, badges, fields or decoration (LA-EXP-DS10): below it no text can be read. Every canvas stage's (paint.ts) and
 * the ERD's.
 */
export const BLOCK_BELOW_PX = 5;

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
 * nothing below it. No level past `deepest` is drawn, nor bars for it: the depth decides how many levels below the focus
 * are drawn (LA-EXP-DS09). `always` adds nodes drawn whatever their size or place (the focus and its direct children),
 * each its own box, never in a bar. The same viewport always draws the same.
 */
export function drawnFor(map: GraphMap, v: Viewport, width: number, height: number, always: Iterable<string> = [], deepest = Infinity): Drawn {
  const rect = viewRect(v, width, height);
  const z = v.zoom;
  const boxes: DrawnBox[] = [];
  const bars: DrawnBar[] = [];
  const drawn = new Set<string>();
  const kept = new Set(always);
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
      if (small(c) && !kept.has(c.id)) run.push(c); else flush();
    }
    flush();
  };

  // Each level's nodes in view, from the parents of the level before that are in view (drawn or not).
  let open: MapNode[] = map.roots.map((id) => map.nodes.get(id)!).filter(inY);
  for (let level = 0; open.length > 0 && level <= deepest; level++) {
    const big = open.filter((n) => n.h * z >= MIN_DRAWN);
    const shown = big.filter(inX);
    if (boxes.length + shown.length > MAX_DRAWN) {
      // Past the budget: each drawn parent shows its children in this level as one bar.
      const parents = new Set(shown.map((n) => n.parent).filter((p): p is string => p !== null && drawn.has(p)));
      for (const p of parents) barsOf(map.nodes.get(p)!, () => true);
      break;
    }
    for (const n of shown) { boxes.push(box(n)); drawn.add(n.id); }
    if (level === deepest) break;
    const next: MapNode[] = [];
    for (const n of big) {
      if (n.children.length === 0) continue;
      const kids = n.children.map((id) => map.nodes.get(id)!);
      if (drawn.has(n.id) && kids.some((c) => c.h * z < MIN_DRAWN) && inX(kids[0])) barsOf(n, (c) => c.h * z < MIN_DRAWN);
      for (const c of kids) if (c.h * z >= MIN_DRAWN && inY(c)) next.push(c);
    }
    open = next;
  }
  for (const id of kept) {
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

/**
 * The camera that frames a focus in the Nested map (LA-EXP-DS09): its box fills FOCUS_SHARE of the pane's width, whole (a
 * tall box's height caps it), centered, zoomed in no further than `max`; where its children would not read there
 * (childZoom), zoomed in no further than they need, the focus centered where it fits and else shown from its top left
 * edge (placeAlong), so its first children show and the rest are a pan away.
 */
export function frameNested(map: PlacedMap, focus: string, width: number, height: number, max = MAX_ZOOM): Viewport {
  const node = map.nodes.get(focus);
  if (!node || width <= 0 || height <= 0) return { x: width / 2, y: height / 2, zoom: 1 };
  const zoom = Math.max(shareZoom(node.w, node.h, width, height, max), Math.min(max, childZoom(map, focus)));
  const first = childrenStart(map, node);
  return { x: placeAlong(node.x, node.w, zoom, width, first.x), y: placeAlong(node.y, node.h, zoom, height, first.y), zoom };
}

/** The Map's street level (LA-EXP-DS12): the zoom at which every record's text reads at its own size, as the page's text does. */
export const STREET_ZOOM = 1;

/**
 * The camera that frames a focus in the Map (LA-EXP-DS12): the focus whole and centered in the pane (LA-PAT-APP-UX-R23),
 * at street level, or zoomed out until it fills FOCUS_SHARE of the pane's width (a tall one's height caps it) when it
 * is too big to show so there (a use case with its flows, a district), never in past street level. Where its records
 * and areas would not read there (childZoom), it zooms in no further than they need, the focus centered where it fits
 * and else shown from its top left edge, so its first ones show and the rest are a pan away. The Map's walk, quick open
 * and Frame all land here.
 */
export function frameGround(map: GroundMap, focus: string, width: number, height: number, max = MAX_ZOOM): Viewport {
  const node = map.nodes.get(focus);
  if (!node || width <= 0 || height <= 0) return { x: width / 2, y: height / 2, zoom: STREET_ZOOM };
  const top = Math.min(STREET_ZOOM, max);
  const zoom = Math.max(MIN_ZOOM, Math.min(top, shareZoom(node.w, node.h, width, height, max)), Math.min(top, childZoom(map, focus)));
  const first = childrenStart(map, node);
  return { x: placeAlong(node.x, node.w, zoom, width, first.x), y: placeAlong(node.y, node.h, zoom, height, first.y), zoom };
}

/**
 * What a framing must keep whole (LA-PAT-APP-UX-R23): the focus, and in the Tree its children's column with it; where
 * its children cannot read with it whole (frameOnMap, frameNested, frameGround), the part of them the framing `v` shows
 * in a frame `width` by `height`, less FOCUS_CLEAR at each edge. wholeIn keeps it whole as the camera follows.
 */
export function keptBox(map: PlacedMap, focus: string, v: Viewport, width: number, height: number): MapRect | null {
  const node = map.nodes.get(focus);
  if (!node) return null;
  const all = map.view === 'tree' ? withChildren(map, node) : { x: node.x, y: node.y, w: node.w, h: node.h };
  const x0 = Math.max(all.x, (FOCUS_CLEAR - v.x) / v.zoom);
  const y0 = Math.max(all.y, (FOCUS_CLEAR - v.y) / v.zoom);
  const x1 = Math.min(all.x + all.w, (width - FOCUS_CLEAR - v.x) / v.zoom);
  const y1 = Math.min(all.y + all.h, (height - FOCUS_CLEAR - v.y) / v.zoom);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : all;
}

/**
 * What a viewport draws of the Nested map (LA-EXP-DS09), level by level from the roots, a parent
 * before its children so each child is drawn over its parent: a box in view and at least MIN_DRAWN
 * pixels each way on screen is drawn, with its label. A level that would take the drawing past
 * MAX_DRAWN is not drawn, nor anything below it: its parents stand for it, so there are no bars.
 * `always` adds boxes drawn whatever their size or place (the focus and its direct children).
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
