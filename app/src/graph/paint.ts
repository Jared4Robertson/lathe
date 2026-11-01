import type { Look } from './look';
import type { Plate } from './plate';
import { notchOf, type Mark, type Outline, type Shape } from './shapes';
import { MARK_PATHS, SHAPE_PATHS } from './shape-icons';
import { fontFor, type GraphFonts } from './fonts';
import { TITLE_FONT } from './text';
import { BLOCK_BELOW_PX } from './camera';
import { stickyLabel, type ScreenBox } from './sticky';
import { GHOST_MS, markPhase, type StageMarks } from '../changes/marks';
import { rollupText, totalChanges, type Change } from '../changes/rollup';

// The graph's canvas painter (LA-EXP-DS09, LA-EXP-DS10): each frame it draws what the camera
// shows, in screen pixels, from the map's plates (plate.ts). Every point is placed by the camera in
// double precision, relative to the camera's center, and drawn with no transform but the pixel
// ratio, so a box deep in the map is as steady at a very deep zoom as at the top. Each line of a
// label is drawn at its map size times the zoom, so text is crisp at any zoom whatever the map's
// range. Only what is on screen is drawn: a box, a bar or a line wholly outside the canvas (with a
// margin) is passed over. A box whose title would be drawn under BLOCK_BELOW_PX is drawn as a plain
// block, its fill and edge with no label, marks or decoration: its text cannot be read there.

/** The camera as the painter places points: its center in the map, its zoom and the pane's size in CSS pixels. */
export interface Camera { cx: number; cy: number; zoom: number; w: number; h: number }

/** The least strength a box is drawn at for its problem badges to be drawn: fainter, the badge's label cannot be read. */
export const BADGE_LEAST_ALPHA = 0.5;
/**
 * The least size on screen, in CSS pixels, a title reads at: under it a Map's leaf record draws its label from afar
 * (its title alone, larger: ground.ts FAR_TEXT), as labelPlate gives it.
 */
export const READABLE_PX = 9;
/** The plate whose label a box draws at a zoom: a Map leaf's from afar where its own title would read under READABLE_PX, else its own. */
export const labelPlate = <P extends Pick<Plate, 'text' | 'far'>>(p: P, zoom: number): P | Plate => (p.far && p.text * TITLE_FONT * zoom < READABLE_PX ? p.far : p);
/**
 * Whether a box is drawn as a plain block at a zoom: its title under BLOCK_BELOW_PX on screen; a Map's leaf, which has a
 * label from afar, once even that would read under READABLE_PX, so its text is readable or not drawn (LA-EXP-DS12).
 */
export const isBlock = (p: Pick<Plate, 'text' | 'far'>, zoom: number) => (p.far ? p.far.text * TITLE_FONT * zoom < READABLE_PX : p.text * TITLE_FONT * zoom < BLOCK_BELOW_PX);
/** How far past the canvas's edges, in CSS pixels, a box, bar or line still counts as on screen: its stroke and ring reach that far. */
const CULL_PX = 16;
/** Whether a box, a bar or a line's bounds in the map is on the canvas through a camera, with the margin: what a frame draws. */
export const onCanvas = (r: { x: number; y: number; w: number; h: number }, cam: Camera) => {
  const left = (r.x - cam.cx) * cam.zoom + cam.w / 2;
  const top = (r.y - cam.cy) * cam.zoom + cam.h / 2;
  return meets(cam, left, top, left + r.w * cam.zoom, top + r.h * cam.zoom);
};
/** Whether a rectangle on the canvas, in its CSS pixels, meets the canvas with the margin. */
const meets = (cam: Camera, left: number, top: number, right: number, bottom: number) =>
  right >= -CULL_PX && left <= cam.w + CULL_PX && bottom >= -CULL_PX && top <= cam.h + CULL_PX;
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
  /** The words drawn at its middle, at one size on screen: a Map's link line's relation ("Fulfills"). */
  label?: string;
  /** A link that leaves and enters upright, between boxes one above the other (the Map's); level otherwise. */
  upright?: boolean;
  /** The end its words sit by, a little way along it (the Map puts them by the focus, where its lines meet); its middle unless given. */
  labelNear?: 'source' | 'target';
  /** Drawn over the boxes, though it has no words: a Map's then arrow between two steps side by side inside their journey or flow, whose box would cover it. */
  over?: boolean;
}

/** A link's curve in map units (its ends and its two control points), as it is drawn: leaving and entering level, or upright. */
function curveOf(line: Line): [P, P, P, P] {
  const [a, b] = line.points;
  if (line.upright) {
    const bend = Math.max(40, Math.abs(b.y - a.y) / 2) * (b.y >= a.y ? 1 : -1);
    return [a, { x: a.x, y: a.y + bend }, { x: b.x, y: b.y - bend }, b];
  }
  const bend = Math.max(40, Math.abs(b.x - a.x) / 2) * (b.x >= a.x ? 1 : -1);
  return [a, { x: a.x + bend, y: a.y }, { x: b.x - bend, y: b.y }, b];
}

/** The point `t` of the way along a cubic curve. */
function pointOn([p0, p1, p2, p3]: [P, P, P, P], t: number): P {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/** A bar standing for children too small to draw (LA-EXP-DS10), in map units, under its parent: the place it fades with. */
export interface Bar { parent: string; x: number; y: number; w: number; h: number }

/** What a frame draws, in draw order: `wires`, when given, draws a stage's own lines in one go, after the bars and under the boxes (the Trace's links). */
export interface Frame { plates: readonly Plate[]; bars: readonly Bar[]; lines: readonly Line[]; wires?: (ctx: CanvasRenderingContext2D, X: (x: number) => number, Y: (y: number) => number) => void }

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
  /** The part of the canvas no floating panel covers, in CSS pixels: a box cut by its edge draws a sticky label (sticky.ts). */
  open: ScreenBox;
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
    if (!onCanvas(b, cam)) continue;
    ctx.globalAlpha = 0.6 * (state.lit ? lerp(1, look.spotlightDim, state.spot) : 1) * state.strength(b.parent);
    ctx.fillStyle = look.rule;
    ctx.beginPath();
    ctx.roundRect(X(b.x), Y(b.y), b.w * zoom, b.h * zoom, 4 * zoom);
    ctx.fill();
  }
  frame.wires?.(ctx, X, Y);
  const drawLine = (line: Line, fade = 1) => {
    const [a0, b0] = line.points;
    if (!onCanvas({ x: Math.min(a0.x, b0.x), y: Math.min(a0.y, b0.y), w: Math.abs(b0.x - a0.x), h: Math.abs(b0.y - a0.y) }, cam)) return;
    const s = lineStroke(look, line);
    const lit = !state.lit || state.litLines?.has(line.id);
    ctx.globalAlpha = (state.lit ? lerp(s.alpha, lit ? 1 : look.contextOpacity * look.spotlightDim, state.spot) : s.alpha) * lineStrength(line) * fade;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width * line.scale * zoom;
    ctx.setLineDash(s.dash.map((d) => d * zoom));
    const [a, b] = line.points;
    ctx.beginPath();
    ctx.moveTo(X(a.x), Y(a.y));
    if (line.link) {
      const [, c1, c2] = curveOf(line);
      ctx.bezierCurveTo(X(c1.x), Y(c1.y), X(c2.x), Y(c2.y), X(b.x), Y(b.y));
    } else {
      ctx.lineTo(X(b.x), Y(b.y));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (line.link) {
      // The arrow at its end, along the curve's last stretch, which is level (upright for an upright link).
      const len = 3.75 * line.scale * zoom;
      const half = 3 * line.scale * zoom;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(X(b.x), Y(b.y));
      if (line.upright) {
        const dir = b.y >= a.y ? 1 : -1;
        ctx.lineTo(X(b.x) - half, Y(b.y) - dir * len);
        ctx.lineTo(X(b.x) + half, Y(b.y) - dir * len);
      } else {
        const dir = b.x >= a.x ? 1 : -1;
        ctx.lineTo(X(b.x) - dir * len, Y(b.y) - half);
        ctx.lineTo(X(b.x) - dir * len, Y(b.y) + half);
      }
      ctx.closePath();
      ctx.fill();
    }
  };
  // A Map's link lines (named ones) go over the boxes, so a line between two records in one area reads; the rest under them.
  for (const line of frame.lines) if (!line.label && !line.over) drawLine(line);

  const areas: Plate[] = [];
  for (const p of frame.plates) {
    if (!onCanvas(p, cam)) continue;
    const lit = !!state.lit?.has(p.place);
    ctx.globalAlpha = dim(lit) * strength(p.place, lit);
    if (p.area) { paintArea(ctx, p, cam, look, state, X, Y); areas.push(p); } else paintBox(ctx, p, cam, look, fonts, state, X, Y);
    if (state.marks) paintMark(ctx, p, cam, look, fonts, state.marks, state.open, X, Y);
  }
  for (const line of frame.lines) if (line.over) drawLine(line);
  const named = frame.lines.filter((line) => line.label);
  const words = named.length > 0 ? textBoxes(frame.plates, cam, X, Y) : [];
  paintLinkLines(ctx, named, words, cam, drawLine);
  ctx.globalAlpha = 1;
  const areaWords = areas.length > 0 ? paintAreaLabels(ctx, areas, cam, look, fonts, state, X, Y, (p) => { const lit = !!state.lit?.has(p.place); return dim(lit) * strength(p.place, lit); }) : [];
  paintLineLabels(ctx, named, look, fonts, state, X, Y, [...words, ...areaWords], (line) => lineStrength(line));
  if (state.marks) paintGhosts(ctx, cam, look, fonts, state.marks, frame.plates, X, Y);
  if (state.marks?.highlight) paintEdgeHints(ctx, cam, look, fonts, state.marks.highlight.boxes, frame.plates, state.open);

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

/** The dots behind the map, only while they are far enough apart to draw: a tile 24 map units square, placed by the camera (the Graph's, the ERD's). */
const dotTiles = new WeakMap<CanvasRenderingContext2D, { key: string; pattern: CanvasPattern | null }>();
export function paintDots(ctx: CanvasRenderingContext2D, cam: Camera, look: Look) {
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

  // The edge: a polygon's in its state's color and width; every other box keeps its border and is ringed outside it.
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
  if (isBlock(p, zoom)) {
    // A plain block: its fill and its edge, no clip, label, marks or decoration.
    ctx.lineWidth = Math.min(edgeWidth, 1);
    ctx.strokeStyle = edge;
    ctx.stroke();
    return;
  }
  ctx.save();
  // An edge lies inside its outline: clipped to it, at twice its width.
  ctx.clip();
  ctx.lineWidth = 2 * edgeWidth;
  ctx.strokeStyle = edge;
  if (p.dashed) ctx.setLineDash([3 * edgeWidth, 2 * edgeWidth]);
  outlinePath(ctx, p, p.outline, X, Y, zoom);
  ctx.stroke();
  ctx.setLineDash([]);
  if (p.decoration) paintDecoration(ctx, p, p.decoration, edge, colors.fill, p.edged ? edgeWidth / zoom : p.border, X, Y, zoom);
  ctx.restore();

  // The keyboard's focus ring on a box that keeps its border: an outline a little way outside it.
  if (ringed && !p.edged) {
    const width = Math.max(RING_MIN_PX, 3 * s * zoom);
    ctx.strokeStyle = look.steel;
    ctx.lineWidth = width;
    outlinePath(ctx, p, p.outline, X, Y, zoom, 3 * s * zoom + width / 2);
    ctx.stroke();
  }

  // The label: its icons, its lines, its badges; a label the open space's edge cuts drawn in the box's visible part
  // (sticky.ts), its icons and badges left out; one that cannot fit there drawn where the map placed it, cut by the edge.
  // A Map's leaf seen from afar draws its title alone, larger (labelPlate).
  const shown = labelPlate(p, zoom);
  const sticky = stickyLabel(shown, zoom, X, Y, state.open);
  let font = '';
  if (sticky.kind === 'moved') {
    for (const line of sticky.lines) {
      const want = fontFor(fonts, line.face, line.px);
      if (want !== font) { ctx.font = want; font = want; }
      ctx.fillStyle = line.tone === 'ink' ? look.ink : look.muted;
      ctx.fillText(line.text, line.x, line.baseline);
    }
    return;
  }
  for (const icon of shown.icons) paintIcon(ctx, icon.draw, icon.name, X(icon.x), Y(icon.y), icon.w * zoom, icon.h * zoom, colors.edge, colors.fill);
  const faces = lineFonts(shown, zoom, fonts);
  shown.lines.forEach((line, i) => {
    const x = X(line.x);
    const top = Y(line.top);
    if (!meets(cam, x, top, x + line.width * zoom, top + line.height * zoom)) return;
    if (faces[i] !== font) { ctx.font = faces[i]; font = faces[i]; }
    ctx.fillStyle = line.tone === 'ink' ? look.ink : look.muted;
    ctx.fillText(line.text, x, Y(line.baseline));
  });
  // A faded box's badge is not drawn: at its strength the pill's label (white on the badge's color) cannot be read, and
  // a label-less pill is a mark that means nothing. It comes back with the box's strength.
  for (const b of ctx.globalAlpha < BADGE_LEAST_ALPHA ? [] : p.badges) {
    const x = X(b.x);
    const y = Y(b.y);
    const w = b.w * zoom;
    const h = b.h * zoom;
    if (!meets(cam, x, y, x + w, y + h)) continue;
    ctx.fillStyle = b.tone === 'error' ? look.error : look.warn;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(8 * p.text * zoom, h / 2));
    ctx.fill();
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

/** A Map's area's fill by what it is (LA-EXP-DS12): a district the sheet, a stage's neighborhood its stage's fill, a folder's area a lighter lot on it; the ground is the paper itself. */
function areaFill(look: Look, p: Plate): { color: string; alpha: number } | null {
  switch (p.area?.role) {
    case 'district': return { color: look.sheet, alpha: 1 };
    case 'neighborhood': return { color: stageColors(look, p.stage).fill, alpha: 0.6 };
    case 'area': return { color: look.sheet, alpha: 0.75 };
    default: return null;
  }
}

/** A Map's area: its soft fill, no edge (an area, not a box); the focus, the pointer and the keyboard ring it as they ring a box. */
function paintArea(ctx: CanvasRenderingContext2D, p: Plate, cam: Camera, look: Look, state: PaintState, X: (x: number) => number, Y: (y: number) => number) {
  const { zoom } = cam;
  const fill = areaFill(look, p);
  const base = ctx.globalAlpha;
  if (fill) {
    outlinePath(ctx, p, p.outline, X, Y, zoom);
    ctx.globalAlpha = base * fill.alpha;
    ctx.fillStyle = fill.color;
    ctx.fill();
    ctx.globalAlpha = base;
  }
  const ring = state.armed === p.id || state.ring === p.id ? look.steel : state.focus === p.id ? stageColors(look, p.stage).edge : state.hover === p.id ? look.hoverRing : null;
  if (!ring) return;
  outlinePath(ctx, p, p.outline, X, Y, zoom);
  ctx.strokeStyle = ring;
  ctx.lineWidth = Math.max(RING_MIN_PX, 3 * zoom);
  ctx.stroke();
}

/** A Map's area's label size on screen, in CSS pixels, by what it is: fixed whatever the zoom, as a map labels its places. */
export const AREA_LABEL_PX: Readonly<Record<Exclude<NonNullable<Plate['area']>['role'], 'ground'>, number>> = { district: 18, neighborhood: 14, area: 12.5 };
/** The room an area's label keeps from its edges, in CSS pixels. */
const AREA_LABEL_PAD = 10;
/** The least a district is across on screen, in CSS pixels, to carry its name over it when it is too small to hold it. */
const DISTRICT_BLOCK_PX = 12;

/** The smallest an area's name is drawn, in CSS pixels: past it, it is cut with an ellipsis, then left out. */
const AREA_LABEL_FLOOR_PX = 10;

/** The words of a label that fit `room` pixels: the whole, or cut with an ellipsis; null when not even a letter and the ellipsis fit. */
function fitWords(ctx: CanvasRenderingContext2D, text: string, room: number): string | null {
  if (ctx.measureText(text).width <= room) return text;
  for (let n = text.length - 1; n >= 1; n--) {
    const cut = `${text.slice(0, n).trimEnd()}…`;
    if (ctx.measureText(cut).width <= room) return cut;
  }
  return null;
}

/** An area's label fitted to `room` pixels wide: name and count at its size; else the name alone; else (a district's, `shrink`) the name smaller, down to the floor, else cut with an ellipsis at the floor. Another area's is left out where its name does not fit. */
function fitAreaLabel(ctx: CanvasRenderingContext2D, fonts: GraphFonts, name: string, count: string, px: number, room: number, shrink: boolean): { name: string; count: string; px: number; nameW: number; w: number } | null {
  const measure = (text: string, face: 'title' | 'meta', size: number) => { ctx.font = fontFor(fonts, face, size); return ctx.measureText(text).width; };
  const nameW = measure(name, 'title', px);
  const full = nameW + px * 0.6 + measure(count, 'meta', px * 0.8);
  if (full <= room) return { name, count, px, nameW, w: full };
  if (nameW <= room) return { name, count: '', px, nameW, w: nameW };
  if (!shrink) return null;
  const smaller = Math.max(AREA_LABEL_FLOOR_PX, (px * room) / nameW);
  if (smaller < px && measure(name, 'title', smaller) <= room) return { name, count: '', px: smaller, nameW: measure(name, 'title', smaller), w: measure(name, 'title', smaller) };
  ctx.font = fontFor(fonts, 'title', AREA_LABEL_FLOOR_PX);
  const cut = fitWords(ctx, name, room);
  if (!cut) return null;
  const w = ctx.measureText(cut).width;
  return { name: cut, count: '', px: AREA_LABEL_FLOOR_PX, nameW: w, w };
}

/**
 * The Map's area labels (LA-EXP-DS12): each area's name, then its count of records, one line at one size on screen,
 * over a halo of the paper, at its header's top left; an area whose top is out of view keeps its label at the top of
 * what shows of it. A label always fits inside its area: where it does not, the count goes first, then a district's
 * name shrinks to a floor, then it is cut with an ellipsis (another area's is left out); a district too small for its header names itself centered on
 * its block, fitted the same way. No label is drawn over another (parents' first, then those kept in view), nor
 * outside the open space. Returns where they were drawn, which the link lines' words keep clear of.
 */
function paintAreaLabels(ctx: CanvasRenderingContext2D, areas: readonly Plate[], cam: Camera, look: Look, fonts: GraphFonts, state: PaintState, X: (x: number) => number, Y: (y: number) => number, alphaOf: (p: Plate) => number): ScreenBox[] {
  const taken: ScreenBox[] = [];
  const placed: { p: Plate; box: ScreenBox; name: string; count: string; px: number; pinned: boolean; nameW: number }[] = [];
  for (const p of areas) {
    const a = p.area!;
    // The ground is the product itself, named in the header strip: it keeps the room for its districts' names.
    if (a.role === 'ground') continue;
    const px = AREA_LABEL_PX[a.role];
    const left = Math.max(X(p.x), state.open.left);
    const top = Math.max(Y(p.y), state.open.top);
    const right = Math.min(X(p.x) + p.w * cam.zoom, state.open.right);
    const bottom = Math.min(Y(p.y) + p.h * cam.zoom, state.open.bottom);
    if (right <= left || bottom <= top) continue;
    const pinned = left > X(p.x) || top > Y(p.y);
    // Its header's top left, inside its padding.
    const room = right - left - 2 * AREA_LABEL_PAD;
    const fit = room > 0 ? fitAreaLabel(ctx, fonts, a.name, a.count, px, room, a.role === 'district') : null;
    if (fit && bottom - top >= fit.px * 1.4 + 1.6 * AREA_LABEL_PAD) {
      const at = { x: left + AREA_LABEL_PAD, y: top + AREA_LABEL_PAD * 0.6 };
      placed.push({ p, box: { left: at.x - 2, top: at.y, right: at.x + fit.w + 2, bottom: at.y + fit.px * 1.4 }, name: fit.name, count: fit.count, px: fit.px, pinned, nameW: fit.nameW });
      continue;
    }
    // Zoomed out past its header, a district is a labeled block: its name centered on it, inside it.
    if (a.role !== 'district' || right - left < DISTRICT_BLOCK_PX || bottom - top < DISTRICT_BLOCK_PX) continue;
    const small = fitAreaLabel(ctx, fonts, a.name, '', px, right - left - 4, true);
    if (!small || small.px * 1.4 > bottom - top) continue;
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const h = small.px * 1.4;
    placed.push({ p, box: { left: cx - small.w / 2 - 2, top: cy - h / 2, right: cx + small.w / 2 + 2, bottom: cy + h / 2 }, name: small.name, count: '', px: small.px, pinned: true, nameW: small.nameW });
  }
  const order = [...placed.filter((l) => !l.pinned), ...placed.filter((l) => l.pinned)];
  ctx.lineJoin = 'round';
  for (const l of order) {
    const { box } = l;
    if (taken.some((t) => box.left < t.right && box.right > t.left && box.top < t.bottom && box.bottom > t.top)) continue;
    taken.push(box);
    ctx.globalAlpha = alphaOf(l.p);
    const baseline = box.top + l.px * 1.05;
    const halo = (text: string, x: number) => { ctx.strokeText(text, x, baseline); ctx.fillText(text, x, baseline); };
    ctx.strokeStyle = look.paper;
    ctx.lineWidth = 4;
    ctx.font = fontFor(fonts, 'title', l.px);
    ctx.fillStyle = look.ink;
    halo(l.name, box.left + 2);
    if (l.count) {
      ctx.font = fontFor(fonts, 'meta', l.px * 0.8);
      ctx.fillStyle = look.muted;
      halo(l.count, box.left + 2 + l.nameW + l.px * 0.6);
    }
  }
  ctx.lineJoin = 'miter';
  ctx.globalAlpha = 1;
  return taken;
}

/** A link line's words size on screen, in CSS pixels, and their padding on the paper. */
const LINE_LABEL_PX = 10.5;
const LINE_LABEL_PAD = 3;
/** How faint a link line is where it crosses a box's words: a title is never struck through. */
const LINE_OVER_TEXT = 0.12;

/** The words of every box drawn, on screen: what link lines fade across and their names keep clear of. */
const textBoxes = (plates: readonly Plate[], cam: Camera, X: (x: number) => number, Y: (y: number) => number): ScreenBox[] =>
  plates.filter((p) => !p.area && !isBlock(p, cam.zoom) && onCanvas(p, cam)).map((p) => ({ left: X(p.label.x), top: Y(p.label.y), right: X(p.label.x) + p.label.w * cam.zoom, bottom: Y(p.label.y) + p.label.h * cam.zoom }));

/** Clips to everything but some boxes (`outside`), or to the boxes alone. */
function clipTo(ctx: CanvasRenderingContext2D, boxes: readonly ScreenBox[], cam: Camera, outside: boolean) {
  ctx.beginPath();
  if (outside) ctx.rect(-CULL_PX, -CULL_PX, cam.w + 2 * CULL_PX, cam.h + 2 * CULL_PX);
  for (const b of boxes) ctx.rect(b.left, b.top, b.right - b.left, b.bottom - b.top);
  ctx.clip(outside ? 'evenodd' : 'nonzero');
}

/**
 * A Map's link lines, over the boxes (LA-EXP-DS12): at full strength between boxes, faded where they cross a box's
 * words, so a title is never struck through.
 */
function paintLinkLines(ctx: CanvasRenderingContext2D, lines: readonly Line[], words: readonly ScreenBox[], cam: Camera, draw: (line: Line, fade?: number) => void) {
  if (lines.length === 0) return;
  ctx.save();
  clipTo(ctx, words, cam, true);
  for (const line of lines) draw(line);
  ctx.restore();
  if (words.length === 0) return;
  ctx.save();
  clipTo(ctx, words, cam, false);
  for (const line of lines) draw(line, LINE_OVER_TEXT);
  ctx.restore();
}

/**
 * A Map's link lines' words (LA-EXP-DS12): each relation's name on the paper, at one size on screen, in free space along
 * its line (between boxes, in a gutter), never over a box's words, an area's name or another line's; searched from the
 * end its line names (the focus) outward. Lines of one relation meeting at one end share one name: "Fulfills ×2".
 */
function paintLineLabels(ctx: CanvasRenderingContext2D, lines: readonly Line[], look: Look, fonts: GraphFonts, state: PaintState, X: (x: number) => number, Y: (y: number) => number, keepClear: readonly ScreenBox[], alphaOf: (line: Line) => number) {
  const groups = new Map<string, Line[]>();
  for (const line of lines) {
    if (!line.label) continue;
    const key = line.labelNear ? `${line.labelNear === 'target' ? line.target : line.source}|${line.labelNear}|${line.label}` : line.id;
    const group = groups.get(key);
    if (group) group.push(line); else groups.set(key, [line]);
  }
  if (groups.size === 0) return;
  ctx.font = fontFor(fonts, 'meta', LINE_LABEL_PX);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const taken: ScreenBox[] = [...keepClear];
  const free = (b: ScreenBox) => b.left >= state.open.left && b.right <= state.open.right && b.top >= state.open.top && b.bottom <= state.open.bottom
    && !taken.some((t) => b.left < t.right && b.right > t.left && b.top < t.bottom && b.bottom > t.top);
  for (const group of groups.values()) {
    const text = group.length > 1 ? `${group[0].label} ×${group.length}` : group[0].label!;
    const width = ctx.measureText(text).width + 2 * LINE_LABEL_PAD;
    const height = LINE_LABEL_PX + 2 * LINE_LABEL_PAD;
    let spot: ScreenBox | null = null;
    let owner: Line | null = null;
    // Each line of the group, from its named end outward, until a place is free.
    for (const line of group) {
      const curve = curveOf(line);
      const fromEnd = line.labelNear === 'target';
      for (let k = 1; k < 40 && !spot; k++) {
        const t = line.labelNear ? (fromEnd ? 1 - k / 40 : k / 40) : 0.5 + (k % 2 ? 1 : -1) * Math.floor(k / 2) / 40;
        if (t <= 0 || t >= 1) continue;
        const at = pointOn(curve, t);
        const b = { left: X(at.x) - width / 2, top: Y(at.y) - height / 2, right: X(at.x) + width / 2, bottom: Y(at.y) + height / 2 };
        if (free(b)) { spot = b; owner = line; }
      }
      if (spot) break;
    }
    if (!spot || !owner) continue;
    taken.push(spot);
    ctx.globalAlpha = alphaOf(owner);
    ctx.fillStyle = look.paper;
    ctx.beginPath();
    ctx.roundRect(spot.left, spot.top, spot.right - spot.left, spot.bottom - spot.top, height / 2);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = look.linkEdge;
    ctx.stroke();
    ctx.fillStyle = look.linkEdge;
    ctx.fillText(text, (spot.left + spot.right) / 2, (spot.top + spot.bottom) / 2 + 0.5);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 1;
}

/**
 * Each label line's font at a zoom, kept per box for the zoom it was last drawn at (the label's text layout on screen is
 * fixed by its map size times the zoom): a pan, which keeps the zoom, draws every label with no font worked out again.
 */
const fontsAt = new WeakMap<Plate, { zoom: number; fonts: GraphFonts; faces: string[] }>();
function lineFonts(p: Plate, zoom: number, fonts: GraphFonts): string[] {
  const known = fontsAt.get(p);
  if (known && known.zoom === zoom && known.fonts === fonts) return known.faces;
  const faces = p.lines.map((line) => fontFor(fonts, line.face, line.size * zoom));
  fontsAt.set(p, { zoom, fonts, faces });
  return faces;
}

/** The least size on screen, in CSS pixels, a box keeps its live mark's dot at. */
const DOT_MIN_BOX_PX = 10;
/** The least size on screen a box has for its pill (New, Changed, Removed) or a container's roll-up: smaller, the dot, or the container above, says it. */
const PILL_MIN_W_PX = 54;
const PILL_MIN_H_PX = 22;
/** A pill's text size, height and side padding in CSS pixels: fixed on screen, so it reads at any zoom. */
const PILL_FONT_PX = 10;
const PILL_H_PX = 15;
const PILL_PAD_PX = 5;

/** The words of a change on its pill. */
export const PILL_WORDS: Record<Change, string> = { added: 'New', changed: 'Changed', removed: 'Removed' };

/** A change's color in the look. */
export const changeColor = (look: Look, change: Change) => (change === 'added' ? look.changeNew : change === 'changed' ? look.changeChanged : look.changeGone);

/** A pill: rounded, filled, its text in `ink`; its left edge at `x`, centered on `y`; returns its right edge. */
export function pill(ctx: CanvasRenderingContext2D, fonts: GraphFonts, text: string, x: number, y: number, fill: string, ink: string, stroke?: string): number {
  ctx.font = fontFor(fonts, 'badge', PILL_FONT_PX);
  const w = ctx.measureText(text).width + 2 * PILL_PAD_PX;
  ctx.beginPath();
  ctx.roundRect(x, y - PILL_H_PX / 2, w, PILL_H_PX, PILL_H_PX / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.lineWidth = 1; ctx.strokeStyle = stroke; ctx.stroke(); }
  ctx.fillStyle = ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + PILL_PAD_PX, y + 0.5);
  ctx.textBaseline = 'alphabetic';
  return x + w;
}

/**
 * A record's marks (changes/marks.ts). The live ones: a new one's soft glow, fading; a changed one's pulse in its own edge
 * color, a ring spreading out and fading; then each one's dot on its top right corner, which lasts. With Highlight
 * changes on: a thick outline in the change's color and a light tint, and a pill on the top edge (New, Changed) where the
 * box is big enough to read it, else the dot; and a container's roll-up ("3 new · 5 changed · 1 removed") beside it.
 */
function paintMark(ctx: CanvasRenderingContext2D, p: Plate, cam: Camera, look: Look, fonts: GraphFonts, marks: StageMarks, open: ScreenBox, X: (x: number) => number, Y: (y: number) => number) {
  const m = marks.mark(p.id);
  const hl = marks.highlight;
  const kind: Change | undefined = hl ? hl.change(p.id) : m && m.change !== 'removed' ? m.change : undefined;
  const roll = hl?.rolls.get(p.place);
  if (!kind && !roll) return;
  const { zoom } = cam;
  const alpha = ctx.globalAlpha;
  const phase = m && m.change !== 'removed' ? markPhase(marks, m) : null;
  if (phase !== null && m) {
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
  if (kind && hl && kind !== 'removed') {
    // The thick outline and the light tint, in the change's color, over the box at full strength.
    ctx.save();
    ctx.globalAlpha = 1;
    outlinePath(ctx, p, p.outline, X, Y, zoom, 0);
    ctx.fillStyle = changeColor(look, kind);
    ctx.globalAlpha = 0.12;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = changeColor(look, kind);
    ctx.lineWidth = Math.max(2.5, 3.5 * p.scale * zoom);
    ctx.stroke();
    ctx.restore();
  }
  // On the part of its top edge in view: a box cut by the canvas's edge or a floating panel keeps its pill and roll-up on what shows.
  const left = Math.max(X(p.x), open.left);
  const right = Math.min(X(p.x) + w, open.right);
  const cut = Y(p.y) < open.top + PILL_H_PX / 2;
  const roomy = right - left >= PILL_MIN_W_PX && h >= PILL_MIN_H_PX;
  let x = left + 6;
  const y = cut ? open.top + PILL_H_PX / 2 + 3 : Y(p.y);
  ctx.save();
  ctx.globalAlpha = 1;
  if (kind && hl && roomy) {
    x = pill(ctx, fonts, PILL_WORDS[kind], x, y, changeColor(look, kind), look.onMark) + 4;
  } else if (kind && Math.min(w, h) >= DOT_MIN_BOX_PX) {
    // On the box's top right corner, as a badge sits, and strong even on a faded box, so a change reads anywhere on the map.
    const r = Math.max(3, Math.min(5, Math.min(w, h) / 8));
    const cx = X(p.x + p.w);
    ctx.fillStyle = look.sheet;
    ctx.beginPath();
    ctx.arc(cx, y, r + 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = changeColor(look, kind);
    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (roll && right - left >= PILL_MIN_W_PX && h >= PILL_MIN_H_PX) {
    // What is under it: all three counts when they fit across the box, else how many changes in all, else nothing.
    const full = rollupText(roll);
    const total = `${totalChanges(roll)} ${totalChanges(roll) === 1 ? 'change' : 'changes'}`;
    ctx.font = fontFor(fonts, 'badge', PILL_FONT_PX);
    const room = right - x - 6;
    const text = ctx.measureText(full).width + 2 * PILL_PAD_PX <= room ? full : ctx.measureText(total).width + 2 * PILL_PAD_PX <= room ? total : null;
    if (text) pill(ctx, fonts, text, x, y, look.sheet, look.ink, look.ink);
  }
  ctx.restore();
}

/**
 * Each removed record's ghost: its outline, dashed, where it was before the reload. Fading out over a few seconds (none
 * under reduced motion); with Highlight changes on, lasting, with its title and a Removed pill, until it is turned off.
 */
export function paintGhosts(ctx: CanvasRenderingContext2D, cam: Camera, look: Look, fonts: GraphFonts, marks: StageMarks, plates: readonly { x: number; y: number; w: number; h: number }[], X: (x: number) => number, Y: (y: number) => number) {
  const lasting = marks.highlight !== null;
  if (marks.reduced && !lasting) return;
  const settled: { x: number; y: number; w: number; h: number }[] = [];
  for (const own of marks.ghosts) {
    const t = lasting ? 0 : (marks.now - own.t) / GHOST_MS;
    let g = own;
    if (lasting) {
      // The map has moved on since the record went, so a box may lie where it was: the ghost steps down the column to the first room clear of every box and ghost.
      const taken = (r: { x: number; y: number; w: number; h: number }) => plates.some((p) => p.x < r.x + r.w && p.x + p.w > r.x && p.y < r.y + r.h && p.y + p.h > r.y) || settled.some((o) => o.x < r.x + r.w && o.x + o.w > r.x && o.y < r.y + r.h && o.y + o.h > r.y);
      for (let k = 0; k < 40 && taken(g); k++) g = { ...g, y: g.y + own.h * 1.15 };
      settled.push(g);
    }
    if (t < 0 || t >= 1 || !onCanvas(g, cam)) continue;
    const x = X(g.x);
    const y = Y(g.y);
    const w = g.w * cam.zoom;
    const h = g.h * cam.zoom;
    ctx.save();
    ctx.globalAlpha = lasting ? 1 : 0.8 * (1 - t);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4 * cam.zoom);
    if (lasting) {
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = look.changeGone;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = look.changeGone;
    ctx.lineWidth = lasting ? 2.5 : 1.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (lasting && w >= PILL_MIN_W_PX && h >= PILL_MIN_H_PX) {
      const title = marks.mark(g.id)?.title;
      // The map has moved on since, so a box may lie where the ghost does: then the ghost shows no title over it.
      const covered = plates.some((p) => p.x < g.x + g.w && p.x + p.w > g.x && p.y < g.y + g.h && p.y + p.h > g.y);
      if (title && !covered && h >= 2 * PILL_H_PX) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 6, y, w - 12, h);
        ctx.clip();
        ctx.font = fontFor(fonts, 'title', 11);
        ctx.fillStyle = look.ink;
        ctx.textBaseline = 'middle';
        ctx.fillText(title, x + 8, y + h / 2);
        ctx.restore();
      }
      pill(ctx, fonts, PILL_WORDS.removed, x + 6, y, look.changeGone, look.onMark);
    }
    ctx.restore();
  }
}

/** The edge hints' text: "4 changes →", a side's arrow. */
const HINT_ARROWS = { left: '←', right: '→', up: '↑', down: '↓' } as const;
type HintSide = keyof typeof HINT_ARROWS;

/** How many of the changed boxes lie past each edge of the open canvas, by their centers (like graph/hints.tsx pastEdges, in the camera's terms). */
export function changesPastEdges(boxes: readonly { x: number; y: number; w: number; h: number }[], cam: Camera, open: ScreenBox): Record<HintSide, number> {
  const past = { left: 0, right: 0, up: 0, down: 0 };
  for (const b of boxes) {
    const x = (b.x + b.w / 2 - cam.cx) * cam.zoom + cam.w / 2;
    const y = (b.y + b.h / 2 - cam.cy) * cam.zoom + cam.h / 2;
    if (x < open.left) past.left++;
    else if (x > open.right) past.right++;
    if (y < open.top) past.up++;
    else if (y > open.bottom) past.down++;
  }
  return past;
}

type Rect = { left: number; top: number; right: number; bottom: number };
const hits = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * At each edge of the open canvas, a chip counting the changed boxes past it ("4 changes →"), docked to that edge and slid
 * along it to the nearest place clear of every drawn box, else of every label, so it never covers a box's text or pills; none for an
 * edge with nothing past it.
 */
function paintEdgeHints(ctx: CanvasRenderingContext2D, cam: Camera, look: Look, fonts: GraphFonts, boxes: readonly { x: number; y: number; w: number; h: number }[], plates: readonly Plate[], open: ScreenBox) {
  if (boxes.length === 0) return;
  const past = changesPastEdges(boxes, cam, open);
  const sx = (x: number) => (x - cam.cx) * cam.zoom + cam.w / 2;
  const sy = (y: number) => (y - cam.cy) * cam.zoom + cam.h / 2;
  const bodies: Rect[] = [];
  const labels: Rect[] = [];
  for (const p of plates) {
    bodies.push({ left: sx(p.x), top: sy(p.y), right: sx(p.x + p.w), bottom: sy(p.y + p.h) });
    labels.push({ left: sx(p.label.x), top: sy(p.label.y), right: sx(p.label.x + p.label.w), bottom: sy(p.label.y + p.label.h) });
    // Its top edge, where its pill and roll-up sit.
    const edge = Math.max(sy(p.y), open.top + PILL_H_PX / 2 + 3);
    const strip = { left: sx(p.x), top: edge - 10, right: sx(p.x + p.w), bottom: edge + 10 };
    labels.push(strip);
    bodies.push(strip);
  }
  const placed: Rect[] = [];
  ctx.save();
  ctx.globalAlpha = 1;
  for (const side of Object.keys(HINT_ARROWS) as HintSide[]) {
    const n = past[side];
    if (n === 0) continue;
    const text = `${n} ${n === 1 ? 'change' : 'changes'} ${HINT_ARROWS[side]}`;
    ctx.font = fontFor(fonts, 'badge', PILL_FONT_PX + 1);
    const w = ctx.measureText(text).width + 2 * PILL_PAD_PX + 4;
    const h = PILL_H_PX;
    const vertical = side === 'left' || side === 'right';
    const lo = (vertical ? open.top : open.left) + 24;
    const hi = (vertical ? open.bottom : open.right) - 24 - (vertical ? 0 : w);
    const at = (t: number): Rect => {
      const x = side === 'left' ? open.left + 4 : side === 'right' ? open.right - 4 - w : t;
      const y = side === 'up' ? open.top + 4 : side === 'down' ? open.bottom - 4 - h : t - h / 2;
      return { left: x, top: y, right: x + w, bottom: y + h };
    };
    // Candidates from the middle of the edge outwards.
    const mid = (lo + hi) / 2;
    const spots: number[] = [mid];
    for (let d = 20; mid - d >= lo || mid + d <= hi; d += 20) { if (mid + d <= hi) spots.push(mid + d); if (mid - d >= lo) spots.push(mid - d); }
    const clear = (r: Rect, against: Rect[]) => !against.some((o) => hits(r, o)) && !placed.some((o) => hits(r, o));
    const rect = [bodies, labels].reduce<Rect | null>((found, against) => found ?? spots.map(at).find((r) => clear(r, against)) ?? null, null) ?? at(mid);
    placed.push(rect);
    pill(ctx, fonts, text, rect.left, (rect.top + rect.bottom) / 2, look.sheet, look.ink, look.changeChanged);
  }
  ctx.restore();
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
