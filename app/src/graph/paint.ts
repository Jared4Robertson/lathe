import type { Look } from './look';
import type { Plate } from './plate';
import { notchOf, type Mark, type Outline, type Shape } from './shapes';
import { MARK_PATHS, SHAPE_PATHS } from './shape-icons';
import { fontFor, type GraphFonts } from './fonts';
import { onScreen } from './hit';
import { GHOST_MS, markPhase, type StageMarks } from '../changes/marks';

// The graph's canvas painter (LA-EXP-DS09, LA-EXP-DS10): each frame it draws what the camera
// shows, in screen pixels, from the map's plates (plate.ts). Every point is placed by the camera in
// double precision, relative to the camera's center, and drawn with no transform but the pixel
// ratio, so a box deep in the map is as steady at a very deep zoom as at the top. Each line of a
// label is drawn at its map size times the zoom, so text is crisp at any zoom whatever the map's
// range; a line under TEXT_BAR_PX on screen is drawn as a faint bar where its glyphs would be.

/** The camera as the painter places points: its center in the map, its zoom and the pane's size in CSS pixels. */
export interface Camera { cx: number; cy: number; zoom: number; w: number; h: number }

/** A label line smaller than this on screen, in CSS pixels, is drawn as a faint bar: it still shows where the label is and how long it is. */
export const TEXT_BAR_PX = 2;
/** The least width on screen of the keyboard's focus ring and a tap's selection, and of the center's ring, in CSS pixels, so they always show. */
const RING_MIN_PX = 2;
const FOCUS_MIN_PX = 1.5;

type P = { x: number; y: number };

/** A line between two boxes: a parent line (level, solid) or a Trace stage's arrow (a curve with an arrow at its end). */
export interface Line {
  id: string;
  /** The places (Plate.place) it joins: the fade and the spotlight read them. */
  source: string;
  target: string;
  /** Its line style's family: 'structure' for a parent line, 'trace' for a Trace stage's arrow. */
  style: string;
  link: boolean;
  points: [P, P];
  /** Its stroke's scale: its child's box scale for a parent line, 1 for an arrow. */
  scale: number;
}

/** A bar standing for children too small to draw (LA-EXP-DS10), in map units, under its parent: the place it fades with. */
export interface Bar { parent: string; x: number; y: number; w: number; h: number }

/** What a frame draws, in draw order. */
export interface Frame { plates: readonly Plate[]; bars: readonly Bar[]; lines: readonly Line[] }

/** The states the frame shows: the focus, the box under the pointer, the keyboard's ring, a tap's selection, and the spotlight. */
export interface PaintState {
  focus: string;
  hover: string | null;
  ring: string | null;
  armed: string | null;
  /** The hover spotlight: the places (Plate.place) and lines it keeps bright, and how far its dimming has faded in (0 to 1). */
  lit: ReadonlySet<string> | null;
  /**
   * The fade (fade.ts): how strongly each place is drawn, 1 in the focus's subtree on the graph; a line takes the fainter
   * of its ends (its source and target places), a bar its parent's.
   */
  strength: (place: string) => number;
  litLines: ReadonlySet<string> | null;
  spot: number;
  /** The live changes' marks (changes/marks.ts): a glow, a pulse, a dot by each changed record, the removed ones' ghosts. */
  marks: StageMarks | null;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A line's stroke: color, width over its scale, dashes and opacity: a parent line in ink, a Trace stage's arrow (LA-V98) solid in the links' color. */
export function lineStroke(look: Look, line: Pick<Line, 'link'>): { color: string; width: number; dash: number[]; alpha: number } {
  if (!line.link) return { color: look.ink, width: 2, dash: [], alpha: 0.75 };
  return { color: look.linkEdge, width: 1.5, dash: [], alpha: 0.9 };
}

/**
 * Every look a box is drawn in, by its swatch in the graph's key (panel.tsx): each of the six stages' colors, the
 * structural records' (product, domain), a group's and an open question's.
 */
export const BOX_LOOKS = [
  'stage-discovery', 'stage-domain-model', 'stage-use-cases', 'stage-interaction-design', 'stage-technical-specification', 'stage-test-plan',
  'stage-structural', 'stage-group', 'kind-question',
] as const;
export type BoxLook = (typeof BOX_LOOKS)[number];

/** A box's look: a group's, an open question's, or its stage's. */
export function boxLook(p: Pick<Plate, 'group' | 'kind' | 'stage'>): BoxLook {
  if (p.group) return 'stage-group';
  if (p.kind === 'question') return 'kind-question';
  return `stage-${p.stage}`;
}

/** A stage's edge and fill colors in the look; the structural colors for a box of no stage. */
export function stageColors(look: Look, stage: Plate['stage']): { edge: string; fill: string } {
  switch (stage) {
    case 'discovery': return { edge: look.discoveryEdge, fill: look.discoveryFill };
    case 'domain-model': return { edge: look.domainModelEdge, fill: look.domainModelFill };
    case 'use-cases': return { edge: look.useCasesEdge, fill: look.useCasesFill };
    case 'interaction-design': return { edge: look.interactionDesignEdge, fill: look.interactionDesignFill };
    case 'technical-specification': return { edge: look.technicalSpecificationEdge, fill: look.technicalSpecificationFill };
    case 'test-plan': return { edge: look.testPlanEdge, fill: look.testPlanFill };
    default: return { edge: look.structuralEdge, fill: look.structuralFill };
  }
}

/** The kind of a Trace stage's gap box (LA-V98-R04): an empty box, dashed, in the warning color. */
export const GAP_KIND = 'gap';

/** A box's edge and fill colors, by its look: an open question keeps its stage's fill; a Trace stage's gap is the warning color on the sheet. */
export function boxColors(look: Look, p: Pick<Plate, 'group' | 'kind' | 'stage'>): { edge: string; fill: string } {
  if (p.kind === GAP_KIND) return { edge: look.warn, fill: look.sheet };
  switch (boxLook(p)) {
    // A group is a folder outlined in its stage's color on the sheet, so it reads as its stage's and as a group.
    case 'stage-group': return { edge: p.stage === 'structural' ? look.muted : stageColors(look, p.stage).edge, fill: look.sheet };
    case 'kind-question': return { edge: look.warn, fill: stageColors(look, p.stage).fill };
    default: return stageColors(look, p.stage);
  }
}

/** Draws one frame. */
export function paint(ctx: CanvasRenderingContext2D, dpr: number, cam: Camera, frame: Frame, look: Look, fonts: GraphFonts, state: PaintState) {
  const { zoom } = cam;
  const X = (x: number) => (x - cam.cx) * zoom + cam.w / 2;
  const Y = (y: number) => (y - cam.cy) * zoom + cam.h / 2;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  // The paper is the pane's own background (the stylesheet's): the canvas draws the map over it, transparent elsewhere.
  ctx.clearRect(0, 0, cam.w, cam.h);
  paintDots(ctx, cam, look);

  const dim = (lit: boolean) => (state.lit && !lit ? lerp(1, look.spotlightDim, state.spot) : 1);
  // The spotlight brings a lit box, faded or not, up to full strength as it fades in.
  const strength = (id: string, lit: boolean) => (state.lit && lit ? lerp(state.strength(id), 1, state.spot) : state.strength(id));
  const lineStrength = (line: Line) => Math.min(strength(line.source, !!state.lit?.has(line.source)), strength(line.target, !!state.lit?.has(line.target)));

  // Bars, then lines, under the boxes.
  for (const b of frame.bars) {
    ctx.globalAlpha = 0.6 * (state.lit ? lerp(1, look.spotlightDim, state.spot) : 1) * state.strength(b.parent);
    ctx.fillStyle = look.rule;
    ctx.beginPath();
    ctx.roundRect(X(b.x), Y(b.y), b.w * zoom, b.h * zoom, 4 * zoom);
    ctx.fill();
  }
  for (const line of frame.lines) {
    const s = lineStroke(look, line);
    const lit = !state.lit || state.litLines?.has(line.id);
    ctx.globalAlpha = (state.lit ? lerp(s.alpha, lit ? 1 : look.contextOpacity * look.spotlightDim, state.spot) : s.alpha) * lineStrength(line);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width * line.scale * zoom;
    ctx.setLineDash(s.dash.map((d) => d * zoom));
    const [a, b] = line.points;
    ctx.beginPath();
    ctx.moveTo(X(a.x), Y(a.y));
    if (line.link) {
      const bend = Math.max(40, Math.abs(b.x - a.x) / 2);
      const dir = b.x >= a.x ? 1 : -1;
      ctx.bezierCurveTo(X(a.x + dir * bend), Y(a.y), X(b.x - dir * bend), Y(b.y), X(b.x), Y(b.y));
    } else {
      ctx.lineTo(X(b.x), Y(b.y));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (line.link) {
      // The arrow at its end, along the curve's last stretch, which is level.
      const dir = b.x >= a.x ? 1 : -1;
      const len = 3.75 * line.scale * zoom;
      const half = 3 * line.scale * zoom;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(X(b.x), Y(b.y));
      ctx.lineTo(X(b.x) - dir * len, Y(b.y) - half);
      ctx.lineTo(X(b.x) - dir * len, Y(b.y) + half);
      ctx.closePath();
      ctx.fill();
    }
  }

  for (const p of frame.plates) {
    if (!onScreen(p, cam)) continue;
    const lit = !!state.lit?.has(p.place);
    ctx.globalAlpha = dim(lit) * strength(p.place, lit);
    paintBox(ctx, p, cam, look, fonts, state, X, Y);
    if (state.marks) paintMark(ctx, p, cam, look, state.marks, X, Y);
  }
  if (state.marks) paintGhosts(ctx, cam, look, state.marks, X, Y);

  ctx.globalAlpha = 1;
  paintVignette(ctx, dpr, cam, look);
}

/**
 * The cut-off at the frame reads as meant: the map fades into the paper at the canvas's edges, as
 * under an inset shadow of the paper `look.vignette` wide spreading a third of that. The fade is
 * cut out of what the canvas drew (so the paper beneath shows through it exactly), with a mask
 * drawn once per size and kept.
 */
const vignettes = new WeakMap<CanvasRenderingContext2D, { key: string; image: HTMLCanvasElement | null }>();
function paintVignette(ctx: CanvasRenderingContext2D, dpr: number, cam: Camera, look: Look) {
  if (look.vignette <= 0 || typeof document === 'undefined') return;
  const w = Math.round(cam.w * dpr);
  const h = Math.round(cam.h * dpr);
  const key = `${w}x${h}|${look.vignette}|${dpr}`;
  let v = vignettes.get(ctx);
  if (!v || v.key !== key) {
    const image = document.createElement('canvas');
    image.width = w;
    image.height = h;
    const g = image.getContext('2d');
    if (g) {
      const blur = look.vignette * dpr;
      const spread = blur / 3;
      const far = 4 * blur;
      // A frame of paper round the canvas, its inner edge the spread in from the canvas's edge: only its shadow is drawn
      // (the frame itself lies far off the image, its shadow offset back onto it), blurred both ways across that edge, as an inset box-shadow is.
      const away = w + h + 2 * far;
      g.beginPath();
      g.rect(-far - away, -far, w + 2 * far, h + 2 * far);
      g.rect(spread - away, spread, w - 2 * spread, h - 2 * spread);
      g.fillStyle = '#000';
      g.shadowColor = '#000';
      g.shadowBlur = blur;
      g.shadowOffsetX = away;
      g.fill('evenodd');
    }
    v = { key, image: g ? image : null };
    vignettes.set(ctx, v);
  }
  if (!v.image) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(v.image, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** The dots behind the map, only while they are far enough apart to draw: a tile 24 map units square, placed by the camera. */
const dotTiles = new WeakMap<CanvasRenderingContext2D, { key: string; pattern: CanvasPattern | null }>();
function paintDots(ctx: CanvasRenderingContext2D, cam: Camera, look: Look) {
  if (cam.zoom < 0.25 || typeof DOMMatrix === 'undefined') return;
  const gap = 24 * cam.zoom;
  const key = `${look.rule}|${gap.toFixed(3)}`;
  let tile = dotTiles.get(ctx);
  if (!tile || tile.key !== key) {
    const size = Math.max(1, Math.round(gap * 2));
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    if (g) {
      g.fillStyle = look.rule;
      g.beginPath();
      g.arc(size / 2, size / 2, Math.max(0.5, cam.zoom) * (size / gap) / 2, 0, Math.PI * 2);
      g.fill();
    }
    tile = { key, pattern: g ? ctx.createPattern(c, 'repeat') : null };
    dotTiles.set(ctx, tile);
  }
  if (!tile.pattern) return;
  const size = Math.max(1, Math.round(gap * 2));
  // The tile's dot sits in its middle; place the grid so a dot falls on every multiple of the gap in the map.
  const ox = ((cam.w / 2 - cam.cx * cam.zoom) % gap) - gap / 2;
  const oy = ((cam.h / 2 - cam.cy * cam.zoom) % gap) - gap / 2;
  tile.pattern.setTransform(new DOMMatrix().translate(ox, oy).scale(gap / size));
  ctx.fillStyle = tile.pattern;
  ctx.fillRect(0, 0, cam.w, cam.h);
}

/** A box's outline as a path in screen pixels, grown by `grow` pixels each way (a ring outside it). */
function outlinePath(ctx: CanvasRenderingContext2D, p: Plate, outline: Outline, X: (x: number) => number, Y: (y: number) => number, zoom: number, grow = 0) {
  ctx.beginPath();
  if (outline.kind === 'polygon') {
    if (grow === 0) {
      outline.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y))));
    } else {
      // Grown about its middle, which keeps a convex outline's shape.
      const cx = X(p.x + p.w / 2);
      const cy = Y(p.y + p.h / 2);
      const sx = (p.w * zoom / 2 + grow) / Math.max(1e-9, p.w * zoom / 2);
      const sy = (p.h * zoom / 2 + grow) / Math.max(1e-9, p.h * zoom / 2);
      outline.points.forEach(([x, y], i) => {
        const px = cx + (X(x) - cx) * sx;
        const py = cy + (Y(y) - cy) * sy;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
    }
    ctx.closePath();
    return;
  }
  const x = X(p.x) - grow;
  const y = Y(p.y) - grow;
  const w = p.w * zoom + 2 * grow;
  const h = p.h * zoom + 2 * grow;
  const rx = outline.rx * zoom + grow;
  const ry = outline.ry * zoom + grow;
  ctx.roundRect(x, y, w, h, [{ x: Math.min(rx, w / 2), y: Math.min(ry, h / 2) }]);
}

function paintBox(ctx: CanvasRenderingContext2D, p: Plate, cam: Camera, look: Look, fonts: GraphFonts, state: PaintState, X: (x: number) => number, Y: (y: number) => number) {
  const { zoom } = cam;
  const colors = boxColors(look, p);
  const isFocus = p.id === state.focus;
  const ringed = state.ring === p.id;
  const armed = state.armed === p.id;
  const hovered = state.hover === p.id && !isFocus;
  const s = p.scale;

  // The edge: a polygon's or a cell's in its state's color and width; every other box keeps its border and is ringed outside it.
  let edge = colors.edge;
  let edgeWidth = p.border * zoom;
  if (p.edged) {
    // The focus is outlined in its own color (its stage's or kind's edge), only stronger: the highlight matches the box.
    if (isFocus) { edge = colors.edge; edgeWidth = Math.max(FOCUS_MIN_PX, 3 * s * zoom); }
    if (hovered) { edge = look.steel; edgeWidth = 2.5 * s * zoom; }
    if (ringed || armed) { edge = look.steel; edgeWidth = Math.max(RING_MIN_PX, 3 * s * zoom); }
  } else {
    // Rings outside the outline, drawn first so the fill covers their inner half.
    const ring = (color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * width;
      outlinePath(ctx, p, p.outline, X, Y, zoom);
      ctx.stroke();
    };
    if (armed) ring(look.steel, Math.max(RING_MIN_PX, 3 * zoom));
    else if (hovered) ring(look.hoverRing, 3 * s * zoom);
    else if (isFocus) ring(colors.edge, Math.max(FOCUS_MIN_PX, 2 * s * zoom));
  }

  outlinePath(ctx, p, p.outline, X, Y, zoom);
  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.save();
  if (p.view === 'voronoi') {
    // A cell's outline is stroked on its line, as an SVG polygon's.
    ctx.lineWidth = edgeWidth;
    ctx.lineJoin = 'round';
  } else {
    // Every other edge lies inside its outline: clipped to it, at twice its width.
    ctx.clip();
    ctx.lineWidth = 2 * edgeWidth;
  }
  ctx.strokeStyle = edge;
  if (p.dashed) ctx.setLineDash(p.view === 'voronoi' ? [6 * s * zoom, 4 * s * zoom] : [3 * edgeWidth, 2 * edgeWidth]);
  outlinePath(ctx, p, p.outline, X, Y, zoom);
  ctx.stroke();
  ctx.setLineDash([]);
  if (p.decoration && p.view !== 'voronoi') paintDecoration(ctx, p, p.decoration, edge, colors.fill, p.edged ? edgeWidth / zoom : p.border, X, Y, zoom);
  ctx.restore();

  // The keyboard's focus ring on a box that keeps its border: an outline a little way outside it.
  if (ringed && !p.edged) {
    const width = Math.max(RING_MIN_PX, 3 * s * zoom);
    ctx.strokeStyle = look.steel;
    ctx.lineWidth = width;
    outlinePath(ctx, p, p.outline, X, Y, zoom, 3 * s * zoom + width / 2);
    ctx.stroke();
  }

  // The label: its icons, its lines, its badges.
  for (const icon of p.icons) paintIcon(ctx, icon.draw, icon.name, X(icon.x), Y(icon.y), icon.w * zoom, icon.h * zoom, colors.edge, colors.fill);
  let font = '';
  for (const line of p.lines) {
    const px = line.size * zoom;
    const x = X(line.x);
    const top = Y(line.top);
    const w = line.width * zoom;
    const h = line.height * zoom;
    if (x + w < 0 || x > cam.w || top + h < 0 || top > cam.h) continue;
    const color = line.tone === 'ink' ? look.ink : look.muted;
    if (px < TEXT_BAR_PX) {
      const alpha = ctx.globalAlpha;
      ctx.globalAlpha = alpha * 0.35;
      ctx.fillStyle = color;
      ctx.fillRect(x, top + h * 0.3, w, Math.max(0.5, h * 0.4));
      ctx.globalAlpha = alpha;
      continue;
    }
    const want = fontFor(fonts, line.face, px);
    if (want !== font) { ctx.font = want; font = want; }
    ctx.fillStyle = color;
    ctx.fillText(line.text, x, Y(line.baseline));
  }
  for (const b of p.badges) {
    const x = X(b.x);
    const y = Y(b.y);
    const w = b.w * zoom;
    const h = b.h * zoom;
    if (x + w < 0 || x > cam.w || y + h < 0 || y > cam.h) continue;
    ctx.fillStyle = b.tone === 'error' ? look.error : look.warn;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(8 * p.text * zoom, h / 2));
    ctx.fill();
    if (b.size * zoom < TEXT_BAR_PX) continue;
    ctx.font = fontFor(fonts, 'badge', b.size * zoom);
    font = '';
    ctx.fillStyle = look.onMark;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, x + w / 2, y + h / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

/** The least size on screen, in CSS pixels, a box keeps its live mark's dot at. */
const DOT_MIN_BOX_PX = 10;

/**
 * A record's live mark (changes/marks.ts): a new one's soft glow, fading; a changed one's pulse in its own edge color,
 * a ring spreading out and fading; then each one's dot on its top right corner, which lasts.
 */
function paintMark(ctx: CanvasRenderingContext2D, p: Plate, cam: Camera, look: Look, marks: StageMarks, X: (x: number) => number, Y: (y: number) => number) {
  const m = marks.mark(p.id);
  if (!m || m.change === 'removed') return;
  const { zoom } = cam;
  const alpha = ctx.globalAlpha;
  const phase = markPhase(marks, m);
  if (phase !== null) {
    ctx.save();
    if (m.change === 'added') {
      ctx.globalAlpha = alpha * 0.7 * (1 - phase);
      ctx.shadowColor = look.changeNew;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = look.changeNew;
      ctx.lineWidth = 3;
      outlinePath(ctx, p, p.outline, X, Y, zoom, 2);
      ctx.stroke();
    } else {
      ctx.globalAlpha = alpha * (1 - phase);
      ctx.strokeStyle = boxColors(look, p).edge;
      ctx.lineWidth = 3;
      outlinePath(ctx, p, p.outline, X, Y, zoom, 2 + 14 * phase);
      ctx.stroke();
    }
    ctx.restore();
  }
  const w = p.w * zoom;
  const h = p.h * zoom;
  if (Math.min(w, h) < DOT_MIN_BOX_PX) return;
  // On the box's top right corner, as a badge sits, and strong even on a faded box, so a change reads anywhere on the map.
  const r = Math.max(3, Math.min(5, Math.min(w, h) / 8));
  const cx = X(p.x + p.w);
  const cy = Y(p.y);
  ctx.globalAlpha = Math.max(alpha, 0.9);
  ctx.fillStyle = look.sheet;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = m.change === 'added' ? look.changeNew : look.changeChanged;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Each removed record's ghost: its outline, dashed, where it was before the reload, fading out (none under reduced motion). */
function paintGhosts(ctx: CanvasRenderingContext2D, cam: Camera, look: Look, marks: StageMarks, X: (x: number) => number, Y: (y: number) => number) {
  if (marks.reduced) return;
  for (const g of marks.ghosts) {
    const t = (marks.now - g.t) / GHOST_MS;
    if (t < 0 || t >= 1) continue;
    ctx.globalAlpha = 0.8 * (1 - t);
    ctx.strokeStyle = look.changeGone;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.roundRect(X(g.x), Y(g.y), g.w * cam.zoom, g.h * cam.zoom, 4 * cam.zoom);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** What a shape draws inside its outline (LA-V93-R06): a page's fold, a stack's front sheet, a flow's inner chevron, an aggregate's second border, a view's window bar, a layer's stripes. */
function paintDecoration(ctx: CanvasRenderingContext2D, p: Plate, shape: Shape, edge: string, fill: string, edgeW: number, X: (x: number) => number, Y: (y: number) => number, zoom: number) {
  const u = p.scale;
  // The padding box: inside a box's border, the whole box for a polygon (which has none).
  const inset = p.edged ? 0 : p.border;
  const x0 = p.x + inset;
  const y0 = p.y + inset;
  const w = p.w - 2 * inset;
  const h = p.h - 2 * inset;
  const rect = (x: number, y: number, rw: number, rh: number) => ctx.fillRect(X(x), Y(y), rw * zoom, rh * zoom);
  const poly = (pts: [number, number][]) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y)))); ctx.closePath(); ctx.fill(); };
  switch (shape) {
    case 'page': {
      const f = notchOf('page', p.w, p.h, u);
      ctx.fillStyle = fill;
      poly([[x0 + w - f, y0], [x0 + w - f, y0 + f], [x0 + w, y0 + f]]);
      const alpha = ctx.globalAlpha;
      ctx.globalAlpha = alpha * 0.55;
      ctx.fillStyle = edge;
      poly([[x0 + w - f, y0], [x0 + w - f, y0 + f], [x0 + w, y0 + f]]);
      ctx.globalAlpha = alpha;
      return;
    }
    case 'stack': {
      const k = notchOf('stack', p.w, p.h, u);
      ctx.fillStyle = edge;
      rect(x0, y0 + k, w - k, edgeW);
      rect(x0 + w - k - edgeW, y0 + k, edgeW, h - k);
      return;
    }
    case 'chevron-bar': {
      const c = notchOf('chevron-bar', p.w, p.h, u);
      const at = 14 * u;
      const wv = 1.4 * edgeW;
      ctx.fillStyle = edge;
      poly([[x0 + w - c - at, y0], [x0 + w - c - at + wv, y0], [x0 + w - at + wv, y0 + h / 2], [x0 + w - c - at + wv, y0 + h], [x0 + w - c - at, y0 + h], [x0 + w - at, y0 + h / 2]]);
      return;
    }
    case 'double': {
      ctx.strokeStyle = edge;
      ctx.lineWidth = u * zoom;
      ctx.beginPath();
      ctx.roundRect(X(x0 + 2.5 * u), Y(y0 + 2.5 * u), (w - 5 * u) * zoom, (h - 5 * u) * zoom, 2.5 * u * zoom);
      ctx.stroke();
      return;
    }
    case 'window': {
      ctx.fillStyle = edge;
      rect(x0, y0, w, 5 * u);
      ctx.fillStyle = fill;
      for (const dx of [5, 9.5, 14]) {
        ctx.beginPath();
        ctx.arc(X(x0 + dx * u), Y(y0 + 2.5 * u), 1.3 * u * zoom, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    case 'stripes': {
      ctx.fillStyle = edge;
      for (const y of [y0 + 2 * u, y0 + 4.5 * u, y0 + h - 3 * u, y0 + h - 5.5 * u]) rect(x0, y, w, u);
      return;
    }
    default:
  }
}

const paths = new Map<string, Path2D>();
const pathOf = (d: string) => { let p = paths.get(d); if (!p) { p = new Path2D(d); paths.set(d, p); } return p; };

/** A shape's or a kind's mark, drawn in its box's edge and fill colors in its icon's box (a 16 by 11 or 11 by 11 drawing, kept in proportion). */
function paintIcon(ctx: CanvasRenderingContext2D, draw: 'shape' | 'mark', name: Shape | Mark, x: number, y: number, w: number, h: number, edge: string, fill: string) {
  if (w < 1 || typeof Path2D === 'undefined') return;
  const [vw, vh] = draw === 'shape' ? [16, 11] : [11, 11];
  const k = Math.min(w / vw, h / vh);
  const layers = draw === 'shape' ? [SHAPE_PATHS[name as Shape]].flat() : [MARK_PATHS[name as Mark]];
  ctx.save();
  ctx.translate(x + (w - vw * k) / 2, y + (h - vh * k) / 2);
  ctx.scale(k, k);
  ctx.lineWidth = 1.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = edge;
  for (const d of layers) {
    const path = pathOf(d);
    ctx.fillStyle = fill;
    ctx.fill(path);
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * 0.14;
    ctx.fillStyle = edge;
    ctx.fill(path);
    ctx.globalAlpha = alpha;
    ctx.stroke(path);
  }
  ctx.restore();
}
