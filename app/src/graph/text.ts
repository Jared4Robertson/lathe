import { kindLabel, type SpecIndex } from '../specs/data';
import { NODE_WIDTH } from './layout';
import { gapsFor, groupLabel, groupMarks, groupOwner } from './model';
import { nodeShape, SHAPES, type Room, type Shape } from './shapes';

// A box's label as part of the map (LA-EXP-DR58): its two lines, the kind and ID line and the
// title, are sized once, in map units, when the map is built, and never change size relative to
// the box; only the camera changes how big they look. Siblings share one text scale: the largest,
// at most a fixed share of their box's size, at which every sibling's whole label fits its room
// (`largestFit`). A long title wraps on whole words, never cut off or ended with an ellipsis.
// Lines are broken here, from a table of character widths, never measured in the page, so the map
// is laid out once and the page draws exactly these lines.

/** A label's font sizes and padding at text scale 1 (a leaf-wide level), in map units; the stylesheet draws them with these. */
export const TITLE_FONT = 12.5;
export const META_FONT = 10.5;
/** A file's title is in the mono face, a little smaller. */
export const FILE_FONT = 11;
/** Every line's height over its font size, and the padding above and below a label and the border around it. */
export const LINE_HEIGHT = 1.4;
export const LABEL_PAD_BLOCK = 6;
export const BORDER = 1.5;
/** The padding on each side of a label, and the room kept beside the kind and ID line for the problem badge. */
export const LABEL_PAD = 14;
export const BADGE_ROOM = 30;
/** The room a small mark takes before the kind and ID line (a shape's in the Nested and Voronoi views, a gear or a ruler), its gap included (LA-EXP-DR65). */
export const MARK_ROOM = 18;
/** The estimate errs wide by this much, so a line never overflows whatever face draws it. */
export const WIDTH_MARGIN = 1.05;

// Advance widths in em of the title's face, Public Sans at 600, or the fallback faces if it does not
// load (system-ui, Helvetica Neue), whichever is widest, measured in Chromium. Any other character
// counts as a full em.
const SANS_CHARS = '0123456789 !"#$%&\'()*+,-./:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~·—–’‘“”…→←↑↓×é';
const SANS_WIDTHS = [640, 556, 618, 649, 644, 659, 643, 615, 661, 643, 278, 300, 463, 627, 671, 1000, 750, 278, 362, 362, 437, 633, 278, 438, 278, 371, 278, 278, 633, 633, 633, 556, 884, 719, 704, 741, 741, 648, 605, 759, 768, 297, 556, 722, 593, 907, 770, 778, 667, 778, 722, 682, 611, 741, 690, 962, 704, 667, 655, 362, 371, 362, 633, 560, 500, 574, 611, 574, 611, 574, 397, 626, 593, 258, 278, 574, 317, 906, 593, 611, 611, 611, 403, 537, 404, 593, 520, 814, 577, 551, 519, 362, 266, 362, 633, 278, 1134, 576, 278, 278, 463, 463, 1000, 1000, 1000, 804, 804, 633, 574];
const SANS = new Map([...SANS_CHARS].map((c, i) => [c, SANS_WIDTHS[i] / 1000]));
/** The kind and ID line's face, JetBrains Mono (or Menlo): every character 0.6 em, a little more to be safe. */
const MONO_EM = 0.61;

/** A title's estimated width at a font size, in the same units. */
export const titleWidth = (text: string, font = TITLE_FONT) => [...text].reduce((sum, c) => sum + (SANS.get(c) ?? 1), 0) * font;
/** A kind and ID line's (or a file's title's) estimated width at a font size. */
export const metaWidth = (text: string, font = META_FONT) => [...text].length * MONO_EM * font;

/**
 * Breaks a text into lines no wider than `width` by `measure`, greedily, only after a space, so no
 * word is cut. A word wider than a line on its own is the one exception: it breaks after one of
 * `breaks` (a hyphen in a title or an ID, a slash in a file's path) and, if a part is still too
 * wide, between characters. The lines joined give the text back; a space ending a line is not measured.
 */
export function wrapText(text: string, width: number, measure: (s: string) => number, breaks = ''): string[] {
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
  const byBreaks = (word: string) => greedy(word.match(new RegExp(`[^${at}]*[${at}]+|[^${at}]+`, 'g')) ?? [word], byChars);
  return greedy(text.match(/\S+\s*|\s+/g) ?? [], at ? byBreaks : byChars);
}

/** What a box's label says: its title and its kind and ID line ("Use case · LA-EXP-UC03", "Group · LA-EXP"). */
export function labelLines(index: SpecIndex, id: string): { title: string; meta: string } {
  const record = index.byId.get(id);
  if (record) return { title: record.title, meta: `${kindLabel(index, record.kind)} · ${id}` };
  if (id.startsWith('file:')) return { title: id.slice(5), meta: 'File' };
  return { title: groupLabel(index, id), meta: `Group · ${groupOwner(index, id)}` };
}

/** Whether a box shows the problem badge: it or, for a group, its members have problems or coverage gaps. */
export const hasMarks = (index: SpecIndex, id: string) => {
  if (id.startsWith('file:')) return false;
  const m = marksOf(index, id);
  return m.errors + m.warnings + m.gaps.length > 0;
};

/** The marks of a node, records' and groups' (summed over the members), cached per index: a group's sum walks everything beneath it. */
const marksCache = new WeakMap<SpecIndex, Map<string, { errors: number; warnings: number; gaps: string[] }>>();
export function marksOf(index: SpecIndex, id: string) {
  let cache = marksCache.get(index);
  if (!cache) { cache = new Map(); marksCache.set(index, cache); }
  const known = cache.get(id);
  if (known) return known;
  let marks: { errors: number; warnings: number; gaps: string[] };
  if (!index.byId.has(id)) marks = groupMarks(index, id);
  else {
    const problems = index.problemsFor.get(id) ?? [];
    const errors = problems.filter((p) => p.severity === 'error').length;
    marks = { errors, warnings: problems.length - errors, gaps: gapsFor(index, id) };
  }
  cache.set(id, marks);
  return marks;
}



/** A label's lines, as the page draws them: each a block of its own, so the page wraps nothing itself. */
export interface WrappedLabel {
  title: string[];
  meta: string[];
  file: boolean;
  /** The height its shape keeps clear above and below it, at text scale 1 (LA-EXP-DR65): none for a box. */
  pad?: number;
}

/** What a label keeps room for besides its padding: its shape's room (the Tree view), the marks before its kind and ID line, the problem badge. */
interface LabelRoom { shape?: Shape; marks?: number; marked?: boolean; centered?: boolean }

const NO_ROOM: Room = { l: 0, r: 0, t: 0, b: 0 };

/** How much less a kind and ID line holds than a title: the marks before it, and the badge's room beside it (on both sides once centered). */
const metaRoom = ({ marks = 0, marked = false, centered = false }: LabelRoom) => marks * MARK_ROOM + (marked ? (centered ? 2 : 1) * BADGE_ROOM : 0);

/**
 * A label broken into lines for a box `width` wide at text scale 1 (LA-EXP-DR58), less the padding,
 * its shape's room (LA-EXP-DR65), and beside the kind and ID line its marks and the badge's room,
 * all erring wide. At a text scale `s`, a box `w` wide wraps its label at `w / s`.
 */
export function wrapLabel(lines: { title: string; meta: string }, { shape, marks = 0, marked = false, centered = false, file = false, width = NODE_WIDTH }: LabelRoom & { file?: boolean; width?: number } = {}): WrappedLabel {
  const room = shape ? SHAPES[shape].room : NO_ROOM;
  const inner = width - 2 * LABEL_PAD - room.l - room.r;
  const titleOf = file ? (s: string) => metaWidth(s, FILE_FONT) * WIDTH_MARGIN : (s: string) => titleWidth(s) * WIDTH_MARGIN;
  const label: WrappedLabel = {
    title: wrapText(lines.title, inner, titleOf, file ? '/-' : '-'),
    meta: wrapText(lines.meta, inner - metaRoom({ marks, marked, centered }), (s) => metaWidth(s) * WIDTH_MARGIN, '-'),
    file,
  };
  const pad = room.t + room.b + (shape === 'circle' ? ellipseRoom(textHeight(label), inner, width) : 0);
  return pad > 0 ? { ...label, pad } : label;
}

/** A label's lines' height at text scale 1. */
const textHeight = (label: WrappedLabel) => LINE_HEIGHT * (label.meta.length * META_FONT + label.title.length * (label.file ? FILE_FONT : TITLE_FONT));

/** The height a circle (an ellipse filling its box) needs past its label's padding so the label's corners stay inside it, at text scale 1. */
function ellipseRoom(text: number, inner: number, width: number): number {
  const across = Math.min(0.95, inner / width);
  const needed = (text + 4) / Math.sqrt(1 - across * across);
  return Math.max(0, Math.ceil(needed - text - 2 * (LABEL_PAD_BLOCK + BORDER)));
}

/** How tall a box must be for its wrapped label at text scale 1: its lines, the padding above and below, the border, and its shape's room. */
export const labelHeight = (label: WrappedLabel) => 2 * (LABEL_PAD_BLOCK + BORDER) + textHeight(label) + (label.pad ?? 0);

// ---------- A map's labels ----------

/** What a box's label says, and what it keeps room for: its shape's room (the Tree view), the marks before its kind and ID line, the problem badge, a file's face. */
export interface MapLabel { title: string; meta: string; shape?: Shape; marks?: number; marked?: boolean; file?: boolean }

/** A node's label in the Tree map and a trace: its kind's shape is its outline, so the label keeps its shape's room, and its kind's mark comes before its kind and ID line (LA-EXP-DR65). */
export function treeLabel(index: SpecIndex, id: string): MapLabel {
  const { shape, mark } = nodeShape(index, id);
  return { ...labelLines(index, id), shape, marks: mark ? 1 : 0, marked: hasMarks(index, id), file: id.startsWith('file:') };
}

/** A node's label in the Nested and Voronoi maps: its lines, its marks (its shape's and its kind's, LA-EXP-DR65) and whether it has the badge. */
export function mapLabel(index: SpecIndex, id: string): MapLabel {
  const marks = id.startsWith('file:') ? 0 : nodeShape(index, id).mark ? 2 : 1;
  return { ...labelLines(index, id), marks, marked: hasMarks(index, id) };
}

/** A label's lines in a box `width` wide at text scale 1 (`wrapLabel`), centered or at the top left. */
export const linesIn = (label: MapLabel, width: number, centered: boolean): WrappedLabel =>
  wrapLabel(label, { shape: label.shape, marks: label.marks, marked: label.marked, centered, file: label.file, width });

const wrapCache = new WeakMap<SpecIndex, Map<string, WrappedLabel>>();
/** A node's label in a trace, broken into lines for a leaf's width at text scale 1, at the top left, cached per index. */
export function labelFor(index: SpecIndex, id: string): WrappedLabel {
  let cache = wrapCache.get(index);
  if (!cache) { cache = new Map(); wrapCache.set(index, cache); }
  const known = cache.get(id);
  if (known) return known;
  const label = linesIn(treeLabel(index, id), NODE_WIDTH, false);
  cache.set(id, label);
  return label;
}

/** The narrowest box a label fits at text scale 1, no word broken: its widest word, its padding, its shape's room and the badge's. */
export function narrowestWidth(label: MapLabel, centered: boolean): number {
  const words = (text: string, measure: (s: string) => number) => text.split(/\s+/).filter(Boolean).map((w) => measure(w) * WIDTH_MARGIN);
  const room = label.shape ? SHAPES[label.shape].room : NO_ROOM;
  const title = label.file ? (s: string) => metaWidth(s, FILE_FONT) : (s: string) => titleWidth(s);
  const meta = metaRoom({ ...label, centered });
  return 2 * LABEL_PAD + room.l + room.r + Math.max(1, ...words(label.title, title), ...words(label.meta, metaWidth).map((w) => w + meta));
}

/** How many halvings find the largest text scale a label fits at: to well under a millionth of it. */
const FIT_ROUNDS = 40;

/**
 * The largest text scale, at most `most`, at which a label fits a room `w` by `h` in map units
 * (LA-EXP-DR58), inside its box's border, `border(s)` thick on every side at a scale `s`:
 * wrapped at the room's width over the scale, no word broken, its lines, padding and shape's room
 * no taller than the room. A smaller scale always fits at least as well (more words to a line,
 * fewer lines, each smaller, and a border no thicker), so the largest is found by halving. 0 only
 * for a room with no space inside its border.
 */
export function largestFit(label: MapLabel, centered: boolean, w: number, h: number, most: number, border: (s: number) => number = () => 0): number {
  const narrowest = narrowestWidth(label, centered);
  if (most <= 0 || w - 2 * border(0) <= 0 || h - 2 * border(0) <= 0) return 0;
  const fits = (s: number) => (w - 2 * border(s)) / s >= narrowest && labelHeight(linesIn(label, (w - 2 * border(s)) / s, centered)) * s <= h - 2 * border(s);
  // No scale fits past the one at which its widest word fills the room's width, nor the one at which its shortest wrapping
  // (one line each) fills its height, inside the border at that scale: found by halving too, which needs no wrapping.
  const shortest = labelHeight(linesIn(label, Infinity, centered));
  const under = (s: number) => s * narrowest <= w - 2 * border(s) && s * shortest <= h - 2 * border(s);
  let hi0 = Math.min(most, (w - 2 * border(0)) / narrowest, (h - 2 * border(0)) / shortest);
  if (!under(hi0)) {
    let below = 0;
    for (let round = 0; round < FIT_ROUNDS; round++) { const mid = (below + hi0) / 2; if (under(mid)) below = mid; else hi0 = mid; }
    hi0 = below;
  }
  if (hi0 <= 0) return 0;
  if (fits(hi0)) return hi0;
  let lo = 0;
  let hi = hi0;
  for (let round = 0; round < FIT_ROUNDS; round++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid; else hi = mid;
  }
  return lo;
}
