import { COLUMN_GAP_SHARE, MAX_COLUMN_SHARE, type GraphMap, type MapNode, type PlacedMap } from './map';
import type { GroundMap } from './ground';

// The camera over the one map (LA-EXP-DS09). Focusing a node, by a click, the address, Back and
// Forward, the step keys or the trail, moves the camera only: it frames the focus and the levels
// the depth shows below it, with the parent's level kept at the left edge for context, the focused box always whole
// (wholeIn, LA-PAT-APP-UX-R23), in one smooth zoom and pan (a van Wijk and Nuij path, as d3's zoom uses). Nothing in the map moves or
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

/** A box and everything under it. */
const subtree = (map: GraphMap, n: MapNode): MapNode[] => [n, ...n.children.flatMap((c) => subtree(map, map.nodes.get(c)!))];

/** The right edge of some boxes and their descendants down to `depth` levels below them. */
function framedRightOf(map: GraphMap, boxes: readonly MapNode[], depth: number): number {
  let right = -Infinity;
  const walk = (n: MapNode, d: number) => {
    right = Math.max(right, n.x + n.w);
    if (d >= depth) return;
    for (const c of n.children) walk(map.nodes.get(c)!, d + 1);
  };
  for (const b of boxes) walk(b, 0);
  return right;
}

/**
 * Where a frame ends on the right, among some boxes in view: in the middle of the gap before the first box past the
 * framed ones (with no padding), or past the framed ones with the padding; a box it would cut is taken in.
 */
function rightEdge(framedRight: number, shown: readonly MapNode[]): { right: number; pad: number } {
  let edge = framedRight;
  for (let pass = 0; pass < shown.length + 1; pass++) {
    const beyond = shown.filter((n) => n.x >= edge).map((n) => n.x);
    const at = beyond.length > 0 ? (edge + Math.min(...beyond)) / 2 : edge;
    const cut = shown.filter((n) => n.x < at && n.x + n.w > at);
    if (cut.length === 0) return { right: at, pad: beyond.length > 0 ? 0 : FRAME_PADDING };
    edge = Math.max(...cut.map((n) => n.x + n.w));
  }
  return { right: edge, pad: FRAME_PADDING };
}

/**
 * Rows i to j of a level, taken whole: their top, the padding above them, and the zoom that fits them in `height`. The
 * margin past a row is half the gap to the next row, at most half a sibling gap (a twentieth of the row), so a wide gap
 * to a cousin far away is not framed; past the level's first or last row, the frame's padding.
 */
function rowsFit(row: readonly MapNode[], i: number, j: number, height: number): { top: number; topPad: number; zoom: number } {
  const margin = (gap: number, h: number) => Math.min(gap / 2, h / 20);
  const top = i > 0 ? row[i].y - margin(row[i].y - (row[i - 1].y + row[i - 1].h), row[i].h) : row[i].y;
  const bottom = j < row.length - 1 ? row[j].y + row[j].h + margin(row[j + 1].y - (row[j].y + row[j].h), row[j].h) : row[j].y + row[j].h;
  const topPad = i > 0 ? 0 : FRAME_PADDING;
  const pads = topPad + (j < row.length - 1 ? 0 : FRAME_PADDING);
  return { top, topPad, zoom: (height - pads) / (bottom - top) };
}

/** The viewport of rows i to j of a level, right-aligned on their edge at `zoom`: filling the height, or centered when they are shorter. */
function placeRows(row: readonly MapNode[], i: number, j: number, fit: { top: number; topPad: number; zoom: number }, edge: { right: number; pad: number }, zoom: number, width: number, height: number): Viewport {
  const y = fit.zoom <= zoom ? fit.topPad - fit.top * zoom : height / 2 - (row[i].y + (row[j].y + row[j].h)) / 2 * zoom;
  return { x: width - edge.pad - edge.right * zoom, y, zoom };
}

/**
 * The camera that frames a focus (LA-EXP-DS09): the focus and its descendants down to `depth` levels below it fill the
 * pane, the parent's level showing in a strip at the left edge (the frame starts at the parent's right edge, past the
 * strip). A node with fewer levels below it frames what it has. Zoomed in no further than `max` (maxZoomFor; the Trace
 * stage's deeper tree takes more).
 *
 * No box of the framed levels is cut at an edge. Top and bottom, the frame takes whole rows of the focus's level, the
 * focus and as many of its neighbors as the width leaves room for, its edges in the gaps between rows (or the padding
 * past the first and last row); every deeper box lies inside a box of the focus's level, so it is whole too. On the
 * right, the frame ends in the gap before the first box past the framed ones in the rows taken (or the padding past the
 * last), and takes in any box it would cut; what width is left over goes to the parent's strip on the left. So the
 * focus itself is always whole (LA-PAT-APP-UX-R23): a focus with many children shows them as far as they fit, and
 * reading them is the next step, walking in.
 */
export function frameOnMap(map: GraphMap, focus: string, depth: number, width: number, height: number, max = MAX_ZOOM): Viewport {
  const node = map.nodes.get(focus);
  if (!node || width <= 0 || height <= 0) return { x: width / 2, y: height / 2, zoom: 1 };
  return frameFocus(map, node, depth, width, height, max);
}

/**
 * Whole rows of the focus's level, from `left` (the parent's right edge), `strip` pixels left over for what lies left of
 * it, and the focus's descendants down to `depth` (frameOnMap). Siblings are taken in until the rows fit the width's zoom.
 */
function frameRows(map: GraphMap, node: MapNode, depth: number, width: number, height: number, max: number, left: number, strip: number): Viewport {
  const framedRight = framedRightOf(map, [node], depth);
  const zoomFor = (edge: { right: number; pad: number }) => Math.min(max, (width - strip - FRAME_PADDING - edge.pad) / (edge.right - left));
  const widthZoom = zoomFor(rightEdge(framedRight, subtree(map, node)));

  // The rows of the focus's level the frame takes, from row i to row j, and the zoom that fits them.
  const row = map.byLevel[node.level];
  let i = row.indexOf(node);
  let j = i;
  let frame = rowsFit(row, i, j, height);
  // Take in a sibling at a time, above and below in turn. Only siblings: a cousin may be far taller, and framing it
  // would shrink the focus. Until the rows fit the width's zoom, a sibling that would take the zoom below ROWS_KEEP of
  // the width's left out (the frame then centers on the rows it has): framing whole rows never costs the focus much of
  // its size on screen.
  const floor = ROWS_KEEP * widthZoom;
  const sibling = (k: number) => k >= 0 && k < row.length && row[k].parent === node.parent;
  for (let up = true; frame.zoom > widthZoom && (sibling(i - 1) || sibling(j + 1)); up = !up) {
    const [was, wasI, wasJ] = [frame, i, j];
    if ((up && sibling(i - 1)) || !sibling(j + 1)) i--;
    else j++;
    frame = rowsFit(row, i, j, height);
    if (frame.zoom < floor) { [frame, i, j] = [was, wasI, wasJ]; break; }
  }
  // The right edge for every row taken (a sibling's own column may reach further than the focus's).
  const edge = rightEdge(framedRight, row.slice(i, j + 1).flatMap((n) => subtree(map, n)));
  return placeRows(row, i, j, frame, edge, Math.min(zoomFor(edge), frame.zoom), width, height);
}

/**
 * The width a focus's own frame always gives it, over its own width: the focus and its children's column at its widest
 * (MAX_COLUMN_SHARE of its width, after its gap). A column narrowed by many children, or a narrow column next that leaves
 * little gap to end the frame in, never zooms the focus in further, so its header reads at the same size on screen
 * however its children and the levels past them grow (LA-EXP-DS06, LA-EXP-DS09).
 */
export const FOCUS_SPAN = 1 + MAX_COLUMN_SHARE * (1 + COLUMN_GAP_SHARE);

/**
 * The focus's own frame: whole rows of its level from the parent's right edge, the parent's level in a strip at the left
 * edge (frameOnMap). Zoomed in no further than frames FOCUS_SPAN of the focus's width with
 * the padding past it: what width is left over goes to the parent's strip.
 */
function frameFocus(map: GraphMap, node: MapNode, depth: number, width: number, height: number, max = MAX_ZOOM): Viewport {
  // From the parent's right edge (the gap to the focus included), or the focus's left edge for a root.
  const parent = node.parent === null ? null : map.nodes.get(node.parent)!;
  const left = parent ? parent.x + parent.w : node.x;
  const strip = parent ? Math.min(PARENT_STRIP_MAX, width * PARENT_STRIP) : 0;
  const span = Math.min(max, (width - strip - 2 * FRAME_PADDING) / (node.x + FOCUS_SPAN * node.w - left));
  return frameRows(map, node, depth, width, height, span, left, strip);
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
 * nothing below it. `always` adds nodes drawn whatever their size or place (the focus). The same
 * viewport always draws the same.
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
export function frameNested(map: PlacedMap, focus: string, width: number, height: number, max = MAX_ZOOM): Viewport {
  const node = map.nodes.get(focus);
  if (!node || width <= 0 || height <= 0) return { x: width / 2, y: height / 2, zoom: 1 };
  const zoom = Math.min(max, (width - 2 * FRAME_PADDING) / Math.max(1, node.w), (height - 2 * FRAME_PADDING) / Math.max(1, node.h));
  return { x: width / 2 - (node.x + node.w / 2) * zoom, y: height / 2 - (node.y + node.h / 2) * zoom, zoom };
}

/** The Map's street level (LA-EXP-DS12): the zoom at which every record's text reads at its own size, as the page's text does. */
export const STREET_ZOOM = 1;

/**
 * The camera that frames a focus in the Map (LA-EXP-DS12): the focus whole and centered in the pane (LA-PAT-APP-UX-R23),
 * at street level, or zoomed out as far as it needs when it is too big to show whole there (a use case with its flows,
 * a district), never in past street level. The Map's walk, quick open and Frame all land here.
 */
export function frameGround(map: GroundMap, focus: string, width: number, height: number, max = MAX_ZOOM): Viewport {
  const node = map.nodes.get(focus);
  if (!node || width <= 0 || height <= 0) return { x: width / 2, y: height / 2, zoom: STREET_ZOOM };
  const fit = Math.min((width - 2 * FRAME_PADDING) / Math.max(1, node.w), (height - 2 * FRAME_PADDING) / Math.max(1, node.h));
  const zoom = Math.max(MIN_ZOOM, Math.min(max, STREET_ZOOM, fit));
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
