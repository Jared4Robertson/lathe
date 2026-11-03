import { BLOCK_BELOW_PX } from '../graph/camera';
import { fontFor, type GraphFonts } from '../graph/fonts';
import { EYEBROW_FONT, TITLE_FONT } from '../graph/text';
import { readLook, type Look } from '../graph/look';
import { changeColor, onCanvas, paintDots, paintGhosts, pill, PILL_WORDS, type Camera } from '../graph/paint';
import { markPhase, type StageMarks } from '../changes/marks';
import { rollupShort, rollupText, type ChangeCounts } from '../changes/rollup';
import { endStrokes, lineEnds, titleLines, type ErdBox, type ErdKind, type ErdLine, type Point, type Rect } from './erd';

// The ERD's canvas painter (LA-V94-R08), on the shared canvas (graph/paint.ts's camera, culling, dots, ghosts and pills):
// each frame it draws what the camera shows. The map is drawn in map units under one transform, so a box, its text and
// its lines scale together with the zoom, as the diagram reads at any size: each domain a region tinted on the paper,
// each aggregate a boundary in the domain model stage's fill around its entities, each entity a sheet edged in the
// stage's color with its title, its root mark and its fields; the lines between them with their ends. Only what is on
// screen is drawn (`onCanvas`). Below BLOCK_BELOW_ZOOM a box is a plain block, its fill and edge with no text: its title
// would be drawn under BLOCK_BELOW_PX. Zoomed out past REGION_LABEL_BELOW, each region's name shows over it at one size
// on screen.

/** A box's title and its kind line (its eyebrow, above it) in map units at zoom 1: the node text scale's (graph/text.ts NODE_TEXT). */
const TITLE_PX = TITLE_FONT;
const EYEBROW_PX = EYEBROW_FONT;
/** Below this zoom a box's title would be drawn under BLOCK_BELOW_PX, so every box is a plain block, its fill and edge with no text or fields. */
export const BLOCK_BELOW_ZOOM = BLOCK_BELOW_PX / TITLE_PX;
/** Below this zoom a region's head is too small to read, and its name shows over it at a readable size. */
export const REGION_LABEL_BELOW = 0.6;
/** Below this zoom a line's ends are too small to tell apart, and only its stroke is drawn. */
const ENDS_BELOW_ZOOM = 0.15;

/** The parts of a box, in map units: its border and padding, a title line, the kind line, a field row, and the gaps between them (heights match erd.ts boxSize). */
const BORDER: Record<ErdKind, number> = { domain: 2, aggregate: 1.5, entity: 1.5 };
const PAD: Record<ErdKind, { x: number; y: number }> = { domain: { x: 14, y: 8 }, aggregate: { x: 14, y: 8 }, entity: { x: 10, y: 8 } };
const TITLE_LINE = 16.25;
/** A domain's or an aggregate's kind line, its eyebrow above its title (erd.ts KIND_LINE). */
const KIND_LINE = 14;
/** A field's type, in the mono face. */
const TYPE_PX = 10.5;
const FIELD_PX = 11.5;
const ROW = 20;
const GAP = 2;
/** The fields' rule: its gap above, then the rule, then its gap below. */
const RULE_ABOVE = 4;
const RULE_BELOW = 4;
/** The root mark: its text size, side padding and height, and the gap it keeps from the title. */
const ROOT_PX = 9.5;
const ROOT_PAD = 5;
const ROOT_H = ROOT_PX * 1.4 + 2;
const ROOT_GAP = 6;
/** A field's type takes at most this share of the row, the gap between them in between. */
const KIND_SHARE = 0.55;
const FIELD_GAP = 8;
/** The rings a box can carry, in map units: the hover's, the pick's and a tap's selection (outside it), and the keyboard's (a gap outside it). */
const RING = 3;
const FOCUS_RING_GAP = 3;
/** The change dot: its size and inset from the box's top right corner. */
const DOT = 9;
const DOT_INSET = 4;
/** A line's stroke, a hovered reference's, its dashes, and its fields' words. */
const LINE_W = 1.4;
const LINE_HOVER_W = 2.2;
const DASH = [6, 4];
const LINE_LABEL_PX = 11;
/** A region's name zoomed out: its size on screen, padding and line height. */
const REGION_PX = 13;
const REGION_PAD = 6;
const REGION_H = REGION_PX * 1.3 + 2;

/** The faces the ERD draws its text in: the theme's display face for titles, its body face for fields, its mono for kinds and marks. */
export interface ErdFonts extends GraphFonts { display: string }

/** The stylesheet's stacks, read from the page's root. */
export function readErdFonts(): ErdFonts {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return { display: read('--display', 'sans-serif'), body: read('--body', 'sans-serif'), mono: read('--mono', 'monospace') };
}

/** The ERD's look: the shared look, a region's fill (the domain model stage's, mixed into the paper), and a box's corners. */
export interface ErdLook extends Look { regionFill: string; radius: number }

/** Reads the look from the tokens as they apply at an element. */
export function readErdLook(at: HTMLElement): ErdLook {
  const look = readLook(at);
  const probe = document.createElement('span');
  probe.style.display = 'none';
  at.appendChild(probe);
  try {
    probe.style.color = 'color-mix(in srgb, var(--g-domain-model-bg) 35%, var(--paper))';
    const regionFill = getComputedStyle(probe).color || look.paper;
    const radius = parseFloat(getComputedStyle(at).getPropertyValue('--node-radius'));
    return { ...look, regionFill, radius: Number.isFinite(radius) ? radius : 4 };
  } finally {
    probe.remove();
  }
}

// ---------- Text, laid out once per box ----------

const titleFont = (f: ErdFonts, px: number) => fontFor(f, 'title', px);
const eyebrowFont = (f: ErdFonts, px: number) => fontFor(f, 'eyebrow', px);
const regionFont = (f: ErdFonts, px: number) => `700 ${px}px ${f.display}`;
const fieldFont = (f: ErdFonts, px: number) => `400 ${px}px ${f.body}`;
const typeFont = (f: ErdFonts, px: number) => fontFor(f, 'mono', px);
const rootFont = (f: ErdFonts, px: number) => `600 ${px}px ${f.mono}`;

let measurer: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, Map<string, number>>();
/** Each time the faces load, the text is measured again: every width and box text made before is dropped. */
let epoch = 0;
export function measureAgain() { widths.clear(); epoch++; }
/** A text's width in a font, in its own pixels: measured by a canvas and kept, or about 0.6 em a letter where there is none (the unit tests). */
function widthOf(font: string, text: string): number {
  let known = widths.get(font);
  if (!known) { known = new Map(); widths.set(font, known); }
  const seen = known.get(text);
  if (seen !== undefined) return seen;
  if (measurer === undefined) measurer = typeof document === 'undefined' ? null : document.createElement('canvas').getContext?.('2d') ?? null;
  let w: number;
  if (measurer) { measurer.font = font; w = measurer.measureText(text).width; } else w = text.length * parseFloat(font.split(' ')[1]) * 0.6;
  known.set(text, w);
  return w;
}

/** A text cut to a width with an ellipsis, or whole when it fits. */
function cut(font: string, text: string, room: number): string {
  if (widthOf(font, text) <= room) return text;
  for (let n = text.length - 1; n >= 1; n--) {
    const t = `${text.slice(0, n).trimEnd()}…`;
    if (widthOf(font, t) <= room) return t;
  }
  return '…';
}

/** A title wrapped to at most `most` lines of `room`, a word too long for a line broken within it, the last line cut with an ellipsis when the title runs on (as the stylesheet's line clamp did). */
function wrap(font: string, title: string, room: number, most: number): string[] {
  const words = title.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  let i = 0;
  while (i < words.length && lines.length < most) {
    const word = words[i];
    const next = line ? `${line} ${word}` : word;
    if (widthOf(font, next) <= room) { line = next; i++; continue; }
    if (line) { lines.push(line); line = ''; continue; }
    // A word wider than a line: as much of it as fits, the rest on the next.
    let n = word.length - 1;
    while (n > 1 && widthOf(font, word.slice(0, n)) > room) n--;
    lines.push(word.slice(0, n));
    words[i] = word.slice(n);
  }
  if (line && lines.length < most) { lines.push(line); line = ''; }
  const rest = [line, ...words.slice(i)].filter(Boolean).join(' ');
  if (rest && lines.length > 0) lines[lines.length - 1] = cut(font, `${lines[lines.length - 1]} ${rest}`, room);
  return lines.length > 0 ? lines : [''];
}

/** A box's text as it is drawn, in map units: its title's lines, its root mark's width, its kind line, and each field's name and type cut to their room. */
export interface BoxText { title: string[]; root: number; kind: string | null; fields: { name: string; type: string; typeWidth: number }[] }

const texts = new WeakMap<ErdBox, { key: string; text: BoxText }>();
/** What a box draws at a width (its layout's), laid out once per box, width and faces. */
export function boxText(box: ErdBox, width: number, kindLine: string, fonts: ErdFonts): BoxText {
  const key = `${epoch}|${width}|${fonts.display}|${fonts.body}|${fonts.mono}`;
  const known = texts.get(box);
  if (known?.key === key) return known.text;
  const inner = width - 2 * (BORDER[box.kind] + PAD[box.kind].x);
  const root = box.root ? widthOf(rootFont(fonts, ROOT_PX), 'ROOT') + 4 * 0.06 * ROOT_PX + 2 * ROOT_PAD + 2 : 0;
  const room = inner - (root ? root + ROOT_GAP : 0);
  const most = box.kind === 'entity' ? titleLines(box.title, width, box.root) : 1;
  const title = wrap(titleFont(fonts, TITLE_PX), box.title, room, most);
  const tf = typeFont(fonts, TYPE_PX);
  const fields = box.fields.map((f) => {
    const type = cut(tf, f.kind, inner * KIND_SHARE);
    const typeWidth = widthOf(tf, type);
    return { name: cut(fieldFont(fonts, FIELD_PX), f.field, inner - typeWidth - FIELD_GAP), type, typeWidth };
  });
  const text: BoxText = { title, root, kind: box.kind === 'entity' ? null : cut(eyebrowFont(fonts, EYEBROW_PX), kindLine, inner), fields };
  texts.set(box, { key, text });
  return text;
}

// ---------- A frame ----------

/** One box a frame draws: the box, where it is drawn now (its layout's place, or on its way there), its text and its states. */
export interface DrawnBox {
  box: ErdBox;
  rect: Rect;
  text: BoxText;
  strength: number;
  /** The record in focus; picked out by the focus; under the pointer; ringed by the keyboard; selected by a first tap. */
  focus: boolean; pick: boolean; hover: boolean; ring: boolean; armed: boolean;
  /** With Highlight changes on, its change from the baseline and what changed under it. */
  hl: { change: 'added' | 'changed' | 'removed' | undefined; roll: ChangeCounts | null } | null;
}

/** One line a frame draws: its ends, its strength, and its fields' words while it is hovered (or always, by touch). */
export interface DrawnLine { line: ErdLine; from: Point; to: Point; strength: number; hover: boolean; label: string | null }

/** What a frame draws, in draw order: the regions and boundaries, the lines, the entities. */
export interface ErdFrame { under: DrawnBox[]; lines: DrawnLine[]; over: DrawnBox[] }

/** A region's name over it zoomed out: its title, its changes' roll-up, where it is and how strongly it is drawn. */
export interface RegionLabel { title: string; roll: ChangeCounts | null; rect: Rect; strength: number }

/** Where a line between two drawn boxes runs, culled with the camera's margin. */
export function lineOnCanvas(a: Rect, b: Rect, offset: number, cam: Camera): { from: Point; to: Point } | null {
  const { from, to } = lineEnds(a, b, offset);
  return onCanvas({ x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), w: Math.abs(to.x - from.x), h: Math.abs(to.y - from.y) }, cam) ? { from, to } : null;
}

/** A box's edge color: a region's, or the domain model stage's (the leader line's from a box). */
export const boxEdge = (look: ErdLook, kind: ErdKind) => colors(look, kind).edge;

/** The box's colors: a region's, a boundary's (or a closed aggregate's), an entity's. */
function colors(look: ErdLook, kind: ErdKind) {
  if (kind === 'domain') return { edge: look.muted, fill: look.regionFill };
  return { edge: look.domainModelEdge, fill: kind === 'aggregate' ? look.domainModelFill : look.sheet };
}

const roundRect = (ctx: CanvasRenderingContext2D, r: Rect, radius: number, grow = 0) => {
  ctx.beginPath();
  ctx.roundRect(r.x - grow, r.y - grow, r.width + 2 * grow, r.height + 2 * grow, Math.max(0, radius + grow));
};

/** Draws one box: its rings, fill and edge, and unless it is a block its text, its change marks and Highlight changes' outline and tint. */
function paintBox(ctx: CanvasRenderingContext2D, d: DrawnBox, look: ErdLook, fonts: ErdFonts, marks: StageMarks | null, zoom: number) {
  const { box, rect: r } = d;
  const c = colors(look, box.kind);
  const border = BORDER[box.kind];
  const radius = look.radius;
  // A faded box reads whole under the pointer, and by touch once selected; a region stays faded.
  ctx.globalAlpha = (d.hover || d.armed) && box.kind !== 'domain' ? 1 : d.strength;
  const ring = d.armed ? look.steel : d.pick ? look.ink : d.hover && !d.focus ? look.hoverRing : null;
  // Outside its edge, stroked so a faded box's ring never shows through its fill.
  if (ring) { roundRect(ctx, r, radius, RING / 2); ctx.lineWidth = RING; ctx.strokeStyle = ring; ctx.stroke(); }
  roundRect(ctx, r, radius);
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.lineWidth = border;
  ctx.strokeStyle = c.edge;
  roundRect(ctx, r, radius, -border / 2);
  ctx.stroke();
  const live = marks?.mark(box.id);
  const mark = live && live.change !== 'removed' ? live : undefined;
  if (zoom < BLOCK_BELOW_ZOOM) {
    if (mark) paintDot(ctx, r, border, mark.change === 'added' ? look.changeNew : look.changeChanged, look);
    return;
  }
  ctx.save();
  roundRect(ctx, r, radius);
  ctx.clip();
  const left = r.x + border + PAD[box.kind].x;
  const right = r.x + r.width - border - PAD[box.kind].x;
  let top = r.y + border + PAD[box.kind].y;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  // A domain's or an aggregate's kind line is its eyebrow, above its title (graph/text.ts NODE_TEXT).
  if (d.text.kind !== null) {
    ctx.font = eyebrowFont(fonts, EYEBROW_PX);
    ctx.fillStyle = look.muted;
    ctx.fillText(d.text.kind, left, top + KIND_LINE / 2);
    top += KIND_LINE;
  }
  ctx.fillStyle = look.ink;
  ctx.font = titleFont(fonts, TITLE_PX);
  d.text.title.forEach((line, i) => ctx.fillText(line, left, top + i * TITLE_LINE + TITLE_LINE / 2));
  if (d.text.root) {
    const x = right - d.text.root;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, top + 0.5, d.text.root - 1, ROOT_H - 1, 3);
    ctx.fillStyle = look.domainModelFill;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = look.domainModelEdge;
    ctx.stroke();
    ctx.fillStyle = look.ink;
    ctx.font = rootFont(fonts, ROOT_PX);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${0.06 * ROOT_PX}px`;
    ctx.fillText('ROOT', x + 1 + ROOT_PAD, top + ROOT_H / 2);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  top += d.text.title.length * TITLE_LINE + GAP;
  if (d.text.fields.length > 0) {
    top += RULE_ABOVE;
    ctx.fillStyle = look.rule;
    ctx.fillRect(left, top, right - left, 1);
    top += 1 + RULE_BELOW;
    d.text.fields.forEach((f, i) => {
      const y = top + i * ROW + ROW / 2;
      ctx.fillStyle = look.ink;
      ctx.font = fieldFont(fonts, FIELD_PX);
      ctx.fillText(f.name, left, y);
      ctx.fillStyle = look.muted;
      ctx.font = typeFont(fonts, TYPE_PX);
      // The type's mono face sits a pixel low beside the name's, as the two share a row's middle on the page.
      ctx.fillText(f.type, right - f.typeWidth, y + 1);
    });
  }
  // A new box's glow or a changed box's pulse, once as it lands, inside its edge.
  const phase = mark && marks ? markPhase(marks, mark) : null;
  if (mark && phase !== null) {
    const opacity = mark.change === 'added' ? 0.8 * (1 - phase) : pulse(phase);
    ctx.globalAlpha *= opacity;
    ctx.lineWidth = 6;
    ctx.strokeStyle = mark.change === 'added' ? look.changeNew : c.edge;
    if (mark.change === 'added') { ctx.shadowColor = look.changeNew; ctx.shadowBlur = 18 * zoom; }
    roundRect(ctx, r, radius);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  const change = d.hl?.change;
  if (change) {
    // Highlight changes: a light tint over the box and a thick outline in the change's color on its edge.
    const color = changeColor(look, change);
    ctx.save();
    ctx.globalAlpha = 0.12;
    roundRect(ctx, r, radius);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  } else if (mark) {
    paintDot(ctx, r, border, mark.change === 'added' ? look.changeNew : look.changeChanged, look);
  }
  if (d.ring) {
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.strokeStyle = look.steel;
    roundRect(ctx, r, radius, FOCUS_RING_GAP + 1.5);
    ctx.stroke();
  }
}

/** A changed box's pulse: strong, fainter, strong again, then gone. */
const pulse = (t: number) => (t < 0.3 ? 1 - 2 * t : t < 0.55 ? 0.4 + (0.6 * (t - 0.3)) / 0.25 : (1 - (t - 0.55) / 0.45));

/** A box's lasting change dot, at its top right corner inside its edge, ringed in the sheet so it reads on any fill. */
function paintDot(ctx: CanvasRenderingContext2D, r: Rect, border: number, color: string, look: ErdLook) {
  const cx = r.x + r.width - border - DOT_INSET - DOT / 2;
  const cy = r.y + border + DOT_INSET + DOT / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, DOT / 2 + 1.5, 0, Math.PI * 2);
  ctx.fillStyle = look.sheet;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, DOT / 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Draws the lines in as few strokes as their looks allow: each by its dashes and strength, the hovered one stronger, then their ends. */
function paintLines(ctx: CanvasRenderingContext2D, lines: readonly DrawnLine[], look: ErdLook, zoom: number) {
  const groups = new Map<string, DrawnLine[]>();
  for (const l of lines) {
    const key = `${l.line.dashed ? 1 : 0}|${l.strength.toFixed(2)}|${l.hover ? 1 : 0}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(l);
  }
  ctx.strokeStyle = look.ink;
  ctx.lineCap = 'butt';
  for (const group of groups.values()) {
    const { line, strength, hover } = group[0];
    ctx.globalAlpha = strength;
    ctx.lineWidth = hover ? LINE_HOVER_W : LINE_W;
    ctx.setLineDash(line.dashed ? DASH : []);
    ctx.beginPath();
    for (const l of group) { ctx.moveTo(l.from.x, l.from.y); ctx.lineTo(l.to.x, l.to.y); }
    ctx.stroke();
    ctx.setLineDash([]);
    if (zoom < ENDS_BELOW_ZOOM) continue;
    ctx.beginPath();
    for (const l of group) {
      for (const run of [...endStrokes(l.from, l.to, l.line.sourceEnd), ...endStrokes(l.to, l.from, l.line.targetEnd)]) {
        run.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      }
    }
    ctx.stroke();
  }
}

/** A line's fields, over its middle, haloed in the paper. */
function paintLineLabels(ctx: CanvasRenderingContext2D, lines: readonly DrawnLine[], look: ErdLook, fonts: ErdFonts) {
  ctx.font = `600 ${LINE_LABEL_PX}px ${fonts.mono}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  for (const l of lines) {
    if (!l.label) continue;
    const x = (l.from.x + l.to.x) / 2;
    const y = (l.from.y + l.to.y) / 2 - 6;
    ctx.globalAlpha = l.strength;
    ctx.lineWidth = 4;
    ctx.strokeStyle = look.paper;
    ctx.strokeText(l.label, x, y);
    ctx.fillStyle = look.ink;
    ctx.fillText(l.label, x, y);
  }
  ctx.textAlign = 'left';
}

/** Highlight changes' pills on each changed box's top edge, at one size on screen: its change, and what changed under it. */
function paintPills(ctx: CanvasRenderingContext2D, boxes: readonly DrawnBox[], look: ErdLook, fonts: ErdFonts, X: (x: number) => number, Y: (y: number) => number) {
  ctx.globalAlpha = 1;
  for (const d of boxes) {
    if (!d.hl || (!d.hl.change && !d.hl.roll)) continue;
    let x = X(d.rect.x) + 6;
    const y = Y(d.rect.y);
    if (d.hl.change) x = pill(ctx, fonts, PILL_WORDS[d.hl.change], x, y, changeColor(look, d.hl.change), look.onMark) + 4;
    if (d.hl.roll) pill(ctx, fonts, rollupText(d.hl.roll), x, y, look.sheet, look.ink, look.ink);
  }
}

/** Whether a region holds its name whole on screen at a zoom (LA-PAT-APP-UX-R12): else none shows, so no name is cut or drawn over its neighbor's. */
export const regionFits = (g: Pick<RegionLabel, 'title' | 'rect'>, zoom: number, fonts: ErdFonts) => g.rect.width * zoom - 8 >= widthOf(regionFont(fonts, REGION_PX), g.title) + 2 * REGION_PAD;

/** Each region's name at the top left of its region, at one size on screen, where the region holds it whole (LA-PAT-APP-UX-R12): none is cut or drawn over its neighbor's. */
function paintRegionLabels(ctx: CanvasRenderingContext2D, regions: readonly RegionLabel[], look: ErdLook, fonts: ErdFonts, X: (x: number) => number, Y: (y: number) => number, zoom: number) {
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (const g of regions) {
    const name = regionFont(fonts, REGION_PX);
    const extra = g.roll ? ` ${rollupShort(g.roll)}` : '';
    if (!regionFits(g, zoom, fonts)) continue;
    const room = g.rect.width * zoom - 8;
    const w = widthOf(name, g.title) + 2 * REGION_PAD;
    const full = Math.min(room, w + (extra ? widthOf(`600 ${REGION_PX}px ${fonts.display}`, extra) : 0));
    const x = X(g.rect.x) + 4;
    const y = Y(g.rect.y) + 4;
    ctx.globalAlpha = g.strength;
    ctx.beginPath();
    ctx.roundRect(x, y, full, REGION_H, 4);
    ctx.fillStyle = look.paper;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = look.rule;
    ctx.beginPath();
    ctx.roundRect(x - 0.5, y - 0.5, full + 1, REGION_H + 1, 4.5);
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, full, REGION_H);
    ctx.clip();
    ctx.fillStyle = look.ink;
    ctx.font = name;
    ctx.fillText(g.title, x + REGION_PAD, y + REGION_H / 2);
    if (extra) {
      ctx.font = `600 ${REGION_PX}px ${fonts.display}`;
      ctx.fillText(cut(ctx.font, extra, full - w), x + w - REGION_PAD, y + REGION_H / 2);
    }
    ctx.restore();
  }
}

/** Draws one frame: the dots, the boxes under the lines, the lines, the entities, Highlight changes' pills, the lines' words, the regions' names zoomed out, and the removed boxes' ghosts. */
export function paintErd(ctx: CanvasRenderingContext2D, dpr: number, cam: Camera, frame: ErdFrame, regions: readonly RegionLabel[], look: ErdLook, fonts: ErdFonts, marks: StageMarks | null) {
  const { zoom } = cam;
  const X = (x: number) => (x - cam.cx) * zoom + cam.w / 2;
  const Y = (y: number) => (y - cam.cy) * zoom + cam.h / 2;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, cam.w, cam.h);
  paintDots(ctx, cam, look);
  // The map in map units, under one transform: a box, its text and its lines scale with the zoom.
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * (cam.w / 2 - cam.cx * zoom), dpr * (cam.h / 2 - cam.cy * zoom));
  for (const d of frame.under) paintBox(ctx, d, look, fonts, marks, zoom);
  paintLines(ctx, frame.lines, look, zoom);
  for (const d of frame.over) paintBox(ctx, d, look, fonts, marks, zoom);
  paintLineLabels(ctx, frame.lines, look, fonts);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (marks?.highlight && zoom >= BLOCK_BELOW_ZOOM) paintPills(ctx, [...frame.under, ...frame.over], look, fonts, X, Y);
  if (zoom < REGION_LABEL_BELOW) paintRegionLabels(ctx, regions, look, fonts, X, Y, zoom);
  if (marks) {
    const boxes = [...frame.under, ...frame.over].map((d) => ({ x: d.rect.x, y: d.rect.y, w: d.rect.width, h: d.rect.height }));
    paintGhosts(ctx, cam, look, fonts, marks, boxes, X, Y);
  }
  ctx.globalAlpha = 1;
}
