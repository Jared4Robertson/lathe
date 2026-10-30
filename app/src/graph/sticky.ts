import type { Plate } from './plate';
import { largestFit, linesIn, LINE_HEIGHT, META_FONT, textMeasure, TITLE_FONT, LABEL_PAD, LABEL_PAD_BLOCK, type Face, type MapLabel } from './text';

// Sticky labels (LA-EXP-DS06): a box only partly inside the open space (cut by a floating panel, the nav or the wiki
// card, or by the canvas's edge) draws its label within its visible part, as a sticky header stays in view: laid out
// anew for that part's width, wrapped on whole words, at no larger a scale than its own, centered in the part. Its room
// is the label's content box, never the padding round it: the padding is where a box's edge, a focus's wider edge and a
// shape's decoration (a stack's front sheet, a page's fold) are drawn, so a moved label always lies on the box's one
// fill and never across the edge between it and a darker strip. A label that cannot fit there at the readable floor is
// not drawn at all, so no text is ever drawn half cut. A label wholly in the open space is drawn as the map placed it.

/** A rectangle on the canvas, in its CSS pixels. */
export interface ScreenBox { left: number; top: number; right: number; bottom: number }

/** How much of a label's side padding, at its box's scale, its room takes in when it is cut: half of it. */
const STICKY_SIDE = LABEL_PAD / 2;

/** The least size, in CSS pixels, a sticky label's title is drawn at: below it the label is not drawn. */
export const STICKY_READ_PX = 9;

/** One line of a sticky label, on the canvas: its text, face, font size, left end and baseline, in CSS pixels. */
export interface StickyLine { text: string; face: Face; px: number; x: number; baseline: number; tone: 'ink' | 'muted' }

/** How a box's label is drawn: as the map placed it, laid out anew in its visible part, or not at all. */
export type Sticky = { kind: 'placed' } | { kind: 'moved'; lines: StickyLine[] } | { kind: 'hidden' };

const PLACED: Sticky = { kind: 'placed' };
const HIDDEN: Sticky = { kind: 'hidden' };
/** The layouts worked out lately, by box and room: a glide asks for the same ones frame after frame. */
const known = new Map<string, Sticky>();
const KNOWN_MAX = 400;

/**
 * How a box's label is drawn under a camera (`X`, `Y` place a map point on the canvas, `zoom` its scale) with `open`
 * the part of the canvas no panel covers: as placed when its lines lie wholly in it (or the box is wholly outside it),
 * else in the box's visible part, or hidden when it cannot fit there with its title at STICKY_READ_PX.
 */
export function stickyLabel(p: Plate, zoom: number, X: (x: number) => number, Y: (y: number) => number, open: ScreenBox): Sticky {
  if (p.lines.length === 0) return PLACED;
  let [l0, t0, l1, t1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const l of p.lines) {
    l0 = Math.min(l0, X(l.x)); l1 = Math.max(l1, X(l.x + l.width));
    t0 = Math.min(t0, Y(l.top)); t1 = Math.max(t1, Y(l.top + l.height));
  }
  const tol = 0.5;
  if (l0 >= open.left - tol && l1 <= open.right + tol && t0 >= open.top - tol && t1 <= open.bottom + tol) return PLACED;
  // The label's room, its content box (inside the box's one fill), cut to the open space.
  const t = p.text;
  const room = stickyRoom(p, X, Y, open);
  const w = room.right - room.left;
  const h = room.bottom - room.top;
  if (w <= 0 || h <= 0) return HIDDEN;
  const most = t * zoom;
  const key = `${p.place}|${Math.round(w)}|${Math.round(h)}|${most.toPrecision(4)}`;
  let laid = known.get(key);
  if (!laid) {
    laid = layOut({ title: p.title, meta: p.meta }, w, h, most);
    if (known.size >= KNOWN_MAX) known.delete(known.keys().next().value!);
    known.set(key, laid);
  }
  if (laid.kind !== 'moved') return laid;
  // Placed in the room's middle (cached relative to it).
  const cx = (room.left + room.right) / 2;
  const cy = (room.top + room.bottom) / 2;
  return { kind: 'moved', lines: laid.lines.map((l) => ({ ...l, x: cx + l.x, baseline: cy + l.baseline })) };
}

/**
 * The room a cut label is laid out in, on the canvas: the label's content box with half its side padding (the box's one
 * fill, clear of its edge, a focus's wider edge and its shape's decoration), cut to the open space. A label laid out
 * there keeps its own side padding at its own scale, so it never meets the edge; a box drawn large keeps only half its
 * padding at its own large scale, so the strip a focus is framed as holds its label at a readable size (camera.ts
 * frameOnMap).
 */
export function stickyRoom(p: Plate, X: (x: number) => number, Y: (y: number) => number, open: ScreenBox): ScreenBox {
  const side = STICKY_SIDE * p.text;
  return {
    left: Math.max(X(p.label.x - side), open.left), right: Math.min(X(p.label.x + p.label.w + side), open.right),
    top: Math.max(Y(p.label.y), open.top), bottom: Math.min(Y(p.label.y + p.label.h), open.bottom),
  };
}

/**
 * The least width on screen a box's label room needs, `height` tall, to lay its label out with its title at `px` or
 * more, at no larger a scale than its own at `zoom`; null when its own scale draws it smaller (frameOnMap's strip).
 */
export function roomFor(p: Plate, zoom: number, height: number, px: number): number | null {
  const most = p.text * zoom;
  const least = px / TITLE_FONT;
  if (most < least || height <= 0) return null;
  const pad = (s: number) => -LABEL_PAD_BLOCK * s;
  const label = { title: p.title, meta: p.meta };
  const fits = (w: number) => largestFit(label, true, w, height, most, pad) >= least * (1 - 1e-9);
  let high = Math.max(1, (p.label.w + 2 * STICKY_SIDE * p.text) * zoom);
  if (!fits(high)) return null;
  let low = 0;
  while (high - low > 0.5) {
    const mid = (low + high) / 2;
    if (fits(mid)) high = mid; else low = mid;
  }
  return high;
}

/**
 * The width on screen a focus's strip needs, at a zoom, for its label to read with its title at `px` (camera.ts
 * frameOnMap's StripFor): its label's room and the padding right of it, in a frame `height` tall; 0 when it cannot.
 */
export const labelStrip = (p: Plate, height: number, px: number) => (zoom: number): number => {
  const room = roomFor(p, zoom, Math.min(height, p.label.h * zoom), px);
  return room === null ? 0 : room + (p.x + p.w - (p.label.x + p.label.w + STICKY_SIDE * p.text)) * zoom;
};

/** A label laid out in a room `w` by `h` on the canvas at a scale of at most `most`, its lines centered on the room's middle (0, 0). */
function layOut(label: MapLabel, w: number, h: number, most: number): Sticky {
  // The room is a content box, but a label is fitted with its padding round it: the room is taken as that much larger on
  // every side, by the block padding (the lesser), so its lines stay inside the room.
  const pad = (s: number) => -LABEL_PAD_BLOCK * s;
  const s = largestFit(label, true, w, h, most, pad);
  if (s * TITLE_FONT < STICKY_READ_PX) return HIDDEN;
  const wrapped = linesIn(label, (w - 2 * pad(s)) / s, true);
  const m = textMeasure();
  const all = [
    ...wrapped.meta.map((text) => ({ text, face: 'meta' as Face, px: META_FONT * s, tone: 'muted' as const })),
    ...wrapped.title.map((text) => ({ text, face: 'title' as Face, px: TITLE_FONT * s, tone: 'ink' as const })),
  ];
  let y = -all.reduce((sum, l) => sum + l.px * LINE_HEIGHT, 0) / 2;
  const lines: StickyLine[] = all.map((l) => {
    const lh = l.px * LINE_HEIGHT;
    const { ascent, descent } = m.metrics(l.face);
    const baseline = y + (lh - (ascent + descent) * l.px) / 2 + ascent * l.px;
    const width = m.em(l.text.trimEnd(), l.face) * l.px;
    y += lh;
    return { text: l.text, face: l.face, px: l.px, x: -width / 2, baseline, tone: l.tone };
  });
  return { kind: 'moved', lines };
}

/**
 * A camera that leaves a box's label drawn (the Owner's rule: a focused box is never left without its label): the
 * camera as it is when the label is drawn under it, placed or moved; else moved right as little as it takes for the
 * box's visible part to hold the label at the readable floor; else, when no move up to most of the open space's width
 * does, moved so the box's middle is the open space's, where its label was placed. The zoom never changes, so the label
 * keeps its size and is never drawn half cut (LA-EXP-DS06).
 */
export function keepLabel(p: Plate, v: { x: number; y: number; zoom: number }, open: ScreenBox): { x: number; y: number; zoom: number } {
  const { zoom } = v;
  const drawnAt = (shift: number) => stickyLabel(p, zoom, (x) => v.x + shift + x * zoom, (y) => v.y + y * zoom, open).kind !== 'hidden';
  if (drawnAt(0)) return v;
  const most = (open.right - open.left) * 0.75;
  if (!drawnAt(most)) {
    const middle = (open.left + open.right) / 2 - (p.x + p.w / 2) * zoom;
    return { ...v, x: Math.max(v.x, middle) };
  }
  // The least move that draws it, to a pixel: drawn at `high`, not at `low`.
  let low = 0;
  let high = most;
  while (high - low > 1) {
    const mid = (low + high) / 2;
    if (drawnAt(mid)) high = mid;
    else low = mid;
  }
  return { ...v, x: v.x + high };
}
