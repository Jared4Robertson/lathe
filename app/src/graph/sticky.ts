import type { Plate } from './plate';
import { BORDER, EYEBROW_FONT, EYEBROW_GAP, eyebrowRuns, STATUS_FONT, largestFit, linesIn, LINE_HEIGHT, NODE_TEXT, textMeasure, TITLE_FONT, LABEL_PAD, LABEL_PAD_BLOCK, type Face, type MapLabel } from './text';

// Sticky labels (LA-EXP-DS06): a box only partly inside the open space (cut by a floating panel, the nav or the wiki
// card, or by the canvas's edge) draws its label within its visible part, as a sticky header stays in view: laid out
// anew for that part's width, wrapped on whole words, at no larger a scale than its own, set in the part as its own label
// is (centered or at its left: text.ts centeredLabel). Its room
// is the label's content box, never the padding round it: the padding is where a box's edge, a focus's wider edge and a
// shape's decoration (a stack's front sheet, a page's fold) are drawn, so a moved label always lies on the box's one
// fill and never across the edge between it and a darker strip. A label that cannot fit there at the readable floor draws
// its title alone there at the floor, a word too long cut with an ellipsis, so nothing runs past the room; only one whose
// room holds not even a letter and an ellipsis is drawn where the map placed it, cut by the edge like the box itself. A label wholly in
// the open space is drawn as the map placed it.

/** A rectangle on the canvas, in its CSS pixels. */
export interface ScreenBox { left: number; top: number; right: number; bottom: number }

/**
 * How much of a label's side padding, at its box's scale, its room takes in when it is cut: all but twice a border, which
 * a focus's wider edge and a shape's decoration (a stack's front sheet) are drawn in.
 */
const STICKY_SIDE = LABEL_PAD - 2 * BORDER;

/** The least size, in CSS pixels, a sticky label's title is drawn at: below it the label is drawn as placed, cut by the edge. */
export const STICKY_READ_PX = 9;

/** One run of a sticky label's line, on the canvas: its text, face, font size, left end and baseline, in CSS pixels. */
export interface StickyLine { text: string; face: Face; px: number; x: number; baseline: number; tone: 'ink' | 'muted' }

/** How a box's label is drawn: as the map placed it, laid out anew in its visible part, or as placed and cut by the edge (it fits nowhere in the visible part). */
export type Sticky = { kind: 'placed' } | { kind: 'moved'; lines: StickyLine[]; clipped?: true } | { kind: 'cut' };

const PLACED: Sticky = { kind: 'placed' };
const CUT: Sticky = { kind: 'cut' };
/** The layouts worked out lately, by box and room: a glide asks for the same ones frame after frame. */
const known = new Map<string, Sticky>();
const KNOWN_MAX = 400;

/**
 * How a box's label is drawn under a camera (`X`, `Y` place a map point on the canvas, `zoom` its scale) with `open`
 * the part of the canvas no panel covers: as placed when its lines lie wholly in it (or the box is wholly outside it),
 * else in the box's visible part (its title alone when its eyebrow leaves no room for it), or as placed, cut
 * by the edge, when its title cannot fit there at STICKY_READ_PX.
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
  if (w <= 0 || h <= 0) return CUT;
  const most = t * zoom;
  const key = `${p.place}|${Math.round(w)}|${Math.round(h)}|${most.toPrecision(4)}`;
  let laid = known.get(key);
  if (!laid) {
    // Its eyebrow goes first when the room cannot hold the whole label: every box keeps its title.
    // A status line in words (a Trace cell's) comes along under the title; it goes before the eyebrow when room is short.
    const status = p.lines.filter((l) => l.level === 'status').map((l) => l.text).join('').trim();
    const own = status ? { status } : {};
    laid = layOut({ title: p.title, meta: p.meta, ...own, badge: false }, w, h, most, p.centered);
    if (laid.kind === 'cut' && status) laid = layOut({ title: p.title, meta: p.meta, badge: false }, w, h, most, p.centered);
    if (laid.kind === 'cut' && p.meta !== '') laid = layOut({ title: p.title, meta: '', badge: false }, w, h, most, p.centered);
    // Its title alone at the floor, a word too long for the room cut with an ellipsis, so nothing is drawn past the room.
    if (laid.kind === 'cut') laid = clipTitle(p.title, w, h, p.centered);
    if (known.size >= KNOWN_MAX) known.delete(known.keys().next().value!);
    known.set(key, laid);
  }
  if (laid.kind !== 'moved') return laid;
  // Placed in the room's middle (cached relative to it).
  const cx = (room.left + room.right) / 2;
  const cy = (room.top + room.bottom) / 2;
  return { kind: 'moved', lines: laid.lines.map((l) => ({ ...l, x: cx + l.x, baseline: cy + l.baseline })), ...(laid.clipped ? { clipped: true as const } : {}) };
}

/**
 * The room a cut label is laid out in, on the canvas: the label's content box with its side padding but twice a border
 * (the box's one fill, clear of its edge, a focus's wider edge and its shape's decoration), cut to the open space. A
 * label laid out there keeps its own side padding at its own scale, so it never meets the edge.
 */
export function stickyRoom(p: Plate, X: (x: number) => number, Y: (y: number) => number, open: ScreenBox): ScreenBox {
  const side = STICKY_SIDE * p.text;
  return {
    left: Math.max(X(p.label.x - side), open.left), right: Math.min(X(p.label.x + p.label.w + side), open.right),
    top: Math.max(Y(p.label.y), open.top), bottom: Math.min(Y(p.label.y + p.label.h), open.bottom),
  };
}

/** A label laid out in a room `w` by `h` on the canvas at a scale of at most `most`, its lines about the room's middle (0, 0): centered on it, or from the room's left. */
function layOut(label: MapLabel, w: number, h: number, most: number, centered: boolean): Sticky {
  // The room is a content box, but a label is fitted with its padding round it: the room is taken as that much larger on
  // every side, by the block padding (the lesser), so its lines stay inside the room.
  const pad = (s: number) => -LABEL_PAD_BLOCK * s;
  const s = largestFit(label, centered, w, h, most, pad);
  if (s * TITLE_FONT < STICKY_READ_PX) return CUT;
  const wrapped = linesIn(label, (w - 2 * pad(s)) / s, centered);
  const m = textMeasure();
  const all = [
    ...wrapped.meta.map((text) => ({ text, level: 'eyebrow' as const, px: EYEBROW_FONT * s })),
    ...wrapped.title.map((text) => ({ text, level: 'title' as const, px: TITLE_FONT * s })),
    ...(wrapped.status ?? []).map((text) => ({ text, level: 'status' as const, px: STATUS_FONT * s })),
  ];
  const gap = wrapped.meta.length > 0 ? EYEBROW_GAP * s : 0;
  let y = -(all.reduce((sum, l) => sum + l.px * LINE_HEIGHT, 0) + gap) / 2;
  const lines: StickyLine[] = [];
  for (const [i, l] of all.entries()) {
    const lh = l.px * LINE_HEIGHT;
    const { ascent, descent } = m.metrics(l.level === 'title' ? 'title' : 'eyebrow');
    const baseline = y + (lh - (ascent + descent) * l.px) / 2 + ascent * l.px;
    const runs = l.level === 'title' ? [{ text: l.text, face: 'title' as Face }] : eyebrowRuns(l.text);
    const widths = runs.map((r, k) => m.em(k === runs.length - 1 ? r.text.trimEnd() : r.text, r.face) * l.px);
    let x = centered ? -widths.reduce((sum, wd) => sum + wd, 0) / 2 : -w / 2;
    runs.forEach((r, k) => {
      lines.push({ text: r.text, face: r.face, px: l.px, x, baseline, tone: NODE_TEXT[l.level].tone });
      x += widths[k];
    });
    y += lh + (i === wrapped.meta.length - 1 ? gap : 0);
  }
  return { kind: 'moved', lines };
}

/**
 * A title alone in a room `w` by `h` on the canvas at the readable floor, wrapped on words, a word wider than the room
 * and the last line that holds more cut with an ellipsis: every line inside the room. Cut when not one line of a letter
 * and an ellipsis fits.
 */
function clipTitle(title: string, w: number, h: number, centered: boolean): Sticky {
  const px = STICKY_READ_PX;
  const lh = px * LINE_HEIGHT;
  const most = Math.floor(h / lh);
  const m = textMeasure();
  const width = (t: string) => m.em(t, 'title') * px;
  /** The longest start of `t` that fits with an ellipsis after it. */
  const ellipsized = (t: string) => {
    let cut = t.trimEnd();
    while (cut.length > 0 && width(`${cut}…`) > w) cut = cut.slice(0, -1).trimEnd();
    return cut.length > 0 ? `${cut}…` : '';
  };
  if (most < 1 || width('W…') > w) return CUT;
  const words = title.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (const [i, word] of words.entries()) {
    const next = line ? `${line} ${word}` : word;
    if (width(next) <= w) { line = next; continue; }
    if (line) { out.push(line); line = ''; }
    if (out.length === most) { out[most - 1] = ellipsized(`${out[most - 1]} ${words.slice(i).join(' ')}`); line = ''; break; }
    if (width(word) <= w) { line = word; continue; }
    // A word wider than the room: cut, and the title ends there.
    out.push(ellipsized(word));
    if (out.length < most && i < words.length - 1) continue;
    break;
  }
  if (line) {
    if (out.length < most) out.push(line);
    else out[most - 1] = ellipsized(`${out[most - 1]} ${line}`);
  }
  if (out.length === 0 || out.some((l) => l === '')) return CUT;
  const { ascent, descent } = m.metrics('title');
  const top = -(out.length * lh) / 2;
  const lines = out.map((text, i) => {
    const baseline = top + i * lh + (lh - (ascent + descent) * px) / 2 + ascent * px;
    return { text, face: 'title' as Face, px, x: centered ? -width(text) / 2 : -w / 2, baseline, tone: NODE_TEXT.title.tone };
  });
  return { kind: 'moved', lines, clipped: true };
}

/**
 * A camera that leaves a box's label drawn (the Owner's rule: a focused box is never left without its label): the
 * camera as it is when the label is drawn under it, placed or moved; else moved right as little as it takes for the
 * box's visible part to hold the label at the readable floor; else, when no move up to most of the open space's width
 * does, moved so the box's middle is the open space's, where its label was placed. The zoom never changes, so the label
 * keeps its size and reads whole (LA-EXP-DS06).
 */
export function keepLabel(p: Plate, v: { x: number; y: number; zoom: number }, open: ScreenBox): { x: number; y: number; zoom: number } {
  const { zoom } = v;
  // Drawn whole: placed, or laid out anew with no word cut.
  const drawnAt = (shift: number) => { const s = stickyLabel(p, zoom, (x) => v.x + shift + x * zoom, (y) => v.y + y * zoom, open); return s.kind === 'placed' || (s.kind === 'moved' && !s.clipped); };
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
