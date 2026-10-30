import { gapsOf, kindLabel, type RecordIndex } from '../exploring/record-summaries/record-index';
import { groupKindLabel, groupLabel, groupMarks, groupOwner } from './model';
import { NODE_WIDTH, nodeShape, SHAPES, type Room, type Shape } from './shapes';

// A box's label as part of the map (LA-EXP-DS06): its two lines, the kind and ID line and the
// title, are sized once, in map units, when the map is built, and never change size relative to
// the box; only the camera changes how big they look. Siblings share one text scale: the largest,
// at most a fixed share of their box's size, at which every sibling's whole label fits its room
// (`largestFit`). A long title wraps on whole words, never cut off or ended with an ellipsis.
// Lines are broken here, with the text measure the canvas draws with (the label's faces, loaded,
// measured by the canvas's own text metrics: fonts.ts), when the map is built (in the layout's worker,
// with the same faces: layout.ts) or a box is first drawn, and the canvas draws exactly these lines (paint.ts).

/** A label's font sizes and padding at text scale 1 (a leaf-wide level), in map units; the canvas draws them with these. */
export const TITLE_FONT = 12.5;
export const META_FONT = 10.5;
/** Every line's height over its font size, and the padding above and below a label and the border around it. */
export const LINE_HEIGHT = 1.4;
export const LABEL_PAD_BLOCK = 6;
export const BORDER = 1.5;
/** The padding on each side of a label, and the room kept beside the kind and ID line for the problem badge. */
export const LABEL_PAD = 14;
export const BADGE_ROOM = 30;
/** The room a small mark takes before the kind and ID line (a shape's in the Nested view, a gear or a ruler), its gap included (LA-V93-R06). */
export const MARK_ROOM = 18;
/** The faces the graph draws text in: a title (the body face at 600), a kind and ID line (the mono face), a problem badge (mono at 700). */
export type Face = 'title' | 'meta' | 'badge';

/**
 * How wide a text is in one of the graph's faces, in em (its width at a 1 px font), and each face's
 * ascent and descent in em. `key` names the faces it measures, so a map laid out with one measure
 * is never read with another.
 */
export interface TextMeasure {
  key: string;
  em: (text: string, face: Face) => number;
  metrics: (face: Face) => { ascent: number; descent: number };
}

const NARROW = new Set(" .,:;'|!il1jI()[]{}`f-tr/");
const WIDE = new Set('mwMW@%');
/**
 * The plain measure, where there is no canvas to measure with (the unit tests, in Node): a rough
 * advance per character class in the sans face, 0.6 em per character in the mono face.
 */
export const PLAIN_MEASURE: TextMeasure = {
  key: 'plain',
  em: (text, face) => {
    if (face !== 'title') return [...text].length * 0.6;
    let w = 0;
    for (const c of text) w += NARROW.has(c) ? 0.3 : WIDE.has(c) ? 0.88 : c >= 'A' && c <= 'Z' ? 0.7 : 0.58;
    return w;
  },
  metrics: () => ({ ascent: 0.95, descent: 0.25 }),
};

let current: TextMeasure = PLAIN_MEASURE;
/** Installs the measure the maps are laid out with: the canvas's, once its faces have loaded (fonts.ts). */
export function setTextMeasure(measure: TextMeasure) { current = measure; }
/** The measure the maps are laid out with now. */
export const textMeasure = () => current;

/** A title's width at a font size, in the same units. */
export const titleWidth = (text: string, font = TITLE_FONT) => current.em(text, 'title') * font;
/** A kind and ID line's width at a font size. */
export const metaWidth = (text: string, font = META_FONT) => current.em(text, 'meta') * font;

/**
 * Breaks a text into lines no wider than `width` by `measure`, greedily, only after a space, so no
 * word is cut. A word wider than a line on its own breaks after one of `breaks` (a code identifier's
 * punctuation in a title), with `camel` also between the words of a camelCase identifier, and, if a part
 * is still too wide, between characters; with `whole` it never breaks and stays on its own line. The
 * lines joined give the text back; a space ending a line is not measured.
 */
export function wrapText(text: string, width: number, measure: (s: string) => number, breaks = '', camel = false, whole = false): string[] {
  const fits = (s: string) => measure(s.trimEnd()) <= width;
  /** Greedy lines of some tokens; a line that is one token too wide is broken by `split`. */
  const greedy = (tokens: readonly string[], split: (token: string) => string[]): string[] => {
    const lines: string[] = [];
    let line = '';
    for (const token of tokens) {
      if (line === '' || fits(line + token)) line += token;
      else { lines.push(line); line = token; }
      if (!fits(line)) { const parts = split(line); line = parts.pop()!; lines.push(...parts); }
    }
    if (line !== '' || lines.length === 0) lines.push(line);
    return lines;
  };
  const byChars = (word: string) => greedy([...word], (c) => [c]);
  const at = breaks.replace(/[\]\\^-]/g, '\\$&');
  const parts = new RegExp(camel ? `[^${at}]*?(?:[${at}]+|[a-z0-9](?=[A-Z]))|[^${at}]+` : `[^${at}]*[${at}]+|[^${at}]+`, 'g');
  const byBreaks = (word: string) => greedy(word.match(parts) ?? [word], byChars);
  return greedy(text.match(/\S+\s*|\s+/g) ?? [], whole ? (word) => [word] : at ? byBreaks : byChars);
}

/** What a box's label says: its title and its kind and ID line ("Use case · LA-EXP-UC03"; a group's "Stage · LA-EXP", "Aggregate folder · LA-EXP"). */
export function labelLines(index: RecordIndex, id: string): { title: string; meta: string } {
  const record = index.byId.get(id);
  if (record) return { title: record.title, meta: `${kindLabel(index, record.kind)} · ${id}` };
  return { title: groupLabel(index, id), meta: `${groupKindLabel(index, id)} · ${groupOwner(index, id)}` };
}

/** The marks of a node, records' and groups' (summed over the members), cached per index: a group's sum walks everything beneath it. */
const marksCache = new WeakMap<RecordIndex, Map<string, { errors: number; warnings: number; gaps: string[] }>>();
export function marksOf(index: RecordIndex, id: string) {
  let cache = marksCache.get(index);
  if (!cache) { cache = new Map(); marksCache.set(index, cache); }
  const known = cache.get(id);
  if (known) return known;
  let marks: { errors: number; warnings: number; gaps: string[] };
  if (!index.byId.has(id)) marks = groupMarks(index, id);
  else {
    const problems = index.problemsFor.get(id) ?? [];
    const errors = problems.filter((p) => p.severity === 'error').length;
    marks = { errors, warnings: problems.length - errors, gaps: gapsOf(index, id) };
  }
  cache.set(id, marks);
  return marks;
}



/** Where a title's word too wide for a line breaks: after a hyphen, or a code identifier's punctuation (LA-STD-MODELING-R09 titles code-bound records by their identifiers). */
const TITLE_BREAKS = '-._:/(';

/** A label's lines, as the canvas draws them: it wraps nothing itself. */
export interface WrappedLabel {
  title: string[];
  meta: string[];
  /** The height its shape keeps clear above and below it, at text scale 1 (LA-V93-R06): none for a box. */
  pad?: number;
}

/**
 * What a label keeps room for besides its padding: its shape's room (the Tree view) and the marks before its kind and ID line.
 * The problem badge's room is always kept, whether the box has the badge now or not, so a badge appearing changes no
 * label's text or size, nor its siblings' (LA-PAT-APP-UX-R22).
 */
interface LabelRoom { shape?: Shape; marks?: number; badge?: boolean; centered?: boolean }

const NO_ROOM: Room = { l: 0, r: 0, t: 0, b: 0 };

/** How much less a kind and ID line holds than a title: the marks before it, and the badge's room beside it (on both sides once centered), kept always. */
const metaRoom = ({ marks = 0, badge = true, centered = false }: LabelRoom) => marks * MARK_ROOM + (badge ? (centered ? 2 : 1) * BADGE_ROOM : 0);

/**
 * A label broken into lines for a box `width` wide at text scale 1 (LA-EXP-DS06), less the padding,
 * its shape's room (LA-V93-R06), and beside the kind and ID line its marks and the badge's room. At a text scale `s`, a box `w` wide wraps its label at `w / s`.
 */
export function wrapLabel(lines: { title: string; meta: string }, { shape, marks = 0, badge = true, centered = false, width = NODE_WIDTH }: LabelRoom & { width?: number } = {}): WrappedLabel {
  const room = shape ? SHAPES[shape].room : NO_ROOM;
  const inner = width - 2 * LABEL_PAD - room.l - room.r;
  const label: WrappedLabel = {
    title: wrapText(lines.title, inner, (s) => titleWidth(s), TITLE_BREAKS, true),
    // The kind and ID line breaks only between words: an ID is never broken across lines (LA-EXP-DS06).
    meta: wrapText(lines.meta, inner - metaRoom({ marks, badge, centered }), (s) => metaWidth(s), '', false, true),
  };
  const pad = room.t + room.b;
  return pad > 0 ? { ...label, pad } : label;
}

/** A label's lines' height at text scale 1. */
const textHeight = (label: WrappedLabel) => LINE_HEIGHT * (label.meta.length * META_FONT + label.title.length * TITLE_FONT);

/** How tall a box must be for its wrapped label at text scale 1: its lines, the padding above and below, the border, and its shape's room. */
export const labelHeight = (label: WrappedLabel) => 2 * (LABEL_PAD_BLOCK + BORDER) + textHeight(label) + (label.pad ?? 0);

// ---------- A map's labels ----------

/**
 * What a box's label says, and what it keeps room for: its shape's room (the Tree view) and the marks before its kind and
 * ID line. A map's label always keeps the badge's room; only a label drawn where no badge sits beside it (a sticky label,
 * laid out anew in a box's visible part: sticky.ts) is `badge: false`.
 */
export interface MapLabel { title: string; meta: string; shape?: Shape; marks?: number; badge?: false }

/** A node's label in the Tree map: its kind's shape is its outline, so the label keeps its shape's room, and its kind's mark comes before its kind and ID line (LA-V93-R06). */
export function treeLabel(index: RecordIndex, id: string): MapLabel {
  const { shape, mark } = nodeShape(index, id);
  return { ...labelLines(index, id), shape, marks: mark ? 1 : 0 };
}

/** A node's label in the Nested map: its lines and its marks (its shape's and its kind's, LA-V93-R06). */
export function mapLabel(index: RecordIndex, id: string): MapLabel {
  const marks = nodeShape(index, id).mark ? 2 : 1;
  return { ...labelLines(index, id), marks };
}

/** A label's lines in a box `width` wide at text scale 1 (`wrapLabel`), centered or at the top left. */
export const linesIn = (label: MapLabel, width: number, centered: boolean): WrappedLabel =>
  wrapLabel(label, { shape: label.shape, marks: label.marks, badge: label.badge ?? true, centered, width });

/** The narrowest box a label fits at text scale 1, no word broken: its widest word, its padding, its shape's room and the badge's. */
export function narrowestWidth(label: MapLabel, centered: boolean): number {
  const words = (text: string, measure: (s: string) => number) => text.split(/\s+/).filter(Boolean).map((w) => measure(w));
  const room = label.shape ? SHAPES[label.shape].room : NO_ROOM;
  const meta = metaRoom({ ...label, centered });
  return 2 * LABEL_PAD + room.l + room.r + Math.max(1, ...words(label.title, (s) => titleWidth(s)), ...words(label.meta, metaWidth).map((w) => w + meta));
}

/** How many halvings find where a label's room crosses a bound: to well under a millionth of the scale. */
const FIT_ROUNDS = 60;

/** The largest scale in [lo, hi] at which `ok` holds, `ok` holding at lo and failing at every scale past the first that fails it. */
function largestWhere(ok: (s: number) => boolean, lo: number, hi: number): number {
  if (ok(hi)) return hi;
  for (let round = 0; round < FIT_ROUNDS; round++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid; else hi = mid;
  }
  return lo;
}

/** The narrowest box, at text scale 1, that breaks a label into the same lines: its widest title line, or its widest kind and ID line and the room beside it. */
function widthKeeping(label: MapLabel, lines: WrappedLabel, centered: boolean): number {
  const room = label.shape ? SHAPES[label.shape].room : NO_ROOM;
  const widest = (texts: readonly string[], measure: (s: string) => number) => Math.max(0, ...texts.map((t) => measure(t.trimEnd())));
  return 2 * LABEL_PAD + room.l + room.r + Math.max(widest(lines.title, (t) => titleWidth(t)), widest(lines.meta, (t) => metaWidth(t)) + metaRoom({ ...label, centered }));
}

/**
 * The largest text scale, at most `most`, at which a label fits a room `w` by `h` in map units
 * (LA-EXP-DS06), inside its box's border, `border(s)` thick on every side at a scale `s`:
 * wrapped at the room's width over the scale, no word broken, its lines, padding and shape's room
 * no taller than the room. 0 only for a room with no space inside its border.
 *
 * A smaller scale always fits at least as well (more words to a line, fewer lines, each smaller, and a border no
 * thicker), and the label breaks into the same lines over a run of scales, so the largest is found a run at a time,
 * wrapping the label once for each: in a run its lines fit up to the scale where their height fills the room, and the
 * run ends where its widest line fills the room's width. Only those two bounds are found by halving, which needs no
 * wrapping.
 */
/** Whether a label fits a room `w` by `h` at a text scale, wrapped as the map wraps it there, inside its border (`largestFit`). */
export function fitsAt(label: MapLabel, centered: boolean, w: number, h: number, s: number, border: (s: number) => number = () => 0): boolean {
  const width = (w - 2 * border(s)) / s;
  return s > 0 && width >= narrowestWidth(label, centered) && labelHeight(linesIn(label, width, centered)) * s <= h - 2 * border(s);
}

/**
 * A scale at or just under `s` at which the label fits: where a run of lines ends, rounding can wrap one more line at the
 * bound itself, so it steps down by a hair until the label fits there, and halves from 0 if it never does.
 */
function settled(label: MapLabel, centered: boolean, w: number, h: number, s: number, border: (s: number) => number): number {
  for (let step = 1e-12; step < 1e-3; step *= 16) {
    const at = s * (1 - step);
    if (fitsAt(label, centered, w, h, s, border)) return s;
    s = at;
  }
  return largestWhere((x) => fitsAt(label, centered, w, h, x, border), 0, s);
}

export function largestFit(label: MapLabel, centered: boolean, w: number, h: number, most: number, border: (s: number) => number = () => 0): number {
  const narrowest = narrowestWidth(label, centered);
  if (most <= 0 || w - 2 * border(0) <= 0 || h - 2 * border(0) <= 0) return 0;
  /** The room's width at a scale, in text scale 1's units: what the label wraps at. */
  const inner = (s: number) => (w - 2 * border(s)) / s;
  /** Whether lines `height` tall at text scale 1 fit the room's height at a scale. */
  const tall = (height: number) => (s: number) => height * s <= h - 2 * border(s);
  // No scale fits past the one at which its widest word fills the room's width, nor the one at which its shortest wrapping
  // (one line each) fills its height.
  const shortest = labelHeight(linesIn(label, Infinity, centered));
  const under = (s: number) => s * narrowest <= w - 2 * border(s) && tall(shortest)(s);
  const hi0 = Math.min(most, (w - 2 * border(0)) / narrowest, (h - 2 * border(0)) / shortest);
  const top = under(hi0) ? hi0 : largestWhere(under, 0, hi0);
  if (top <= 0) return 0;
  // At `top` the label is wrapped narrowest and tallest: at any smaller scale it is no taller, so these lines' height
  // gives a scale that fits.
  let lines = linesIn(label, inner(top), centered);
  if (tall(labelHeight(lines))(top)) return settled(label, centered, w, h, top, border);
  let at = largestWhere(tall(labelHeight(lines)), 0, top);
  for (;;) {
    lines = linesIn(label, inner(at), centered);
    const keep = widthKeeping(label, lines, centered);
    // The run of these lines ends where the room is as narrow as their widest line; within it they fit up to their height.
    const end = largestWhere((s) => inner(s) >= keep, at, top);
    const fit = largestWhere(tall(labelHeight(lines)), at, top);
    if (fit <= end || end >= top) return settled(label, centered, w, h, Math.min(fit, end, top), border);
    // Past the run's end the label breaks into more lines: they fit there, or nothing past the end does.
    const next = linesIn(label, keep * (1 - 1e-12), centered);
    if (!tall(labelHeight(next))(Math.min(top, end * (1 + 1e-12)))) return settled(label, centered, w, h, end, border);
    at = end * (1 + 1e-12);
  }
}
