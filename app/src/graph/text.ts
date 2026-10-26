import { kindLabel, type SpecIndex } from '../specs/data';
import { NODE_WIDTH } from './layout';
import { gapsFor, groupLabel, groupMarks, groupOwner } from './model';

// A box's label as part of the map (LA-EXP-DR58): its two lines, the kind and ID line and the
// title, are sized once, in map units, by its level's text scale (the level's width over a leaf's),
// and never change size relative to the box; only the camera changes how big they look. A long
// title wraps on whole words, never cut off or ended with an ellipsis, and a leaf grows taller to
// fit it. Lines are broken here, from a table of character widths, never measured in the page, so
// the map is laid out once and the page draws exactly these lines.

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
/** A hexagon (a domain, LA-EXP-DR61) keeps its chamfer clear of its label too, at most this at text scale 1. */
export const HEX_ROOM = 12;
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
export interface WrappedLabel { title: string[]; meta: string[]; file: boolean }

/** Whether a box's label is centered (LA-EXP-DR58): a parent's always, and a leaf's in a level wider than a leaf. */
export const isCentered = (text: number, parent: boolean) => parent || text !== 1;

/**
 * A label broken into lines for its box (LA-EXP-DR58). Wrapping is the same at every text scale (a
 * level's width and its text grow together), so lines are broken once, at text scale 1 in a leaf's
 * width (or `width`, a Nested box's width over its text scale), less the padding, a domain's chamfer,
 * and the badge's room beside the kind and ID line (on both sides once centered), all erring wide.
 */
export function wrapLabel(lines: { title: string; meta: string }, { hexagon = false, marked = false, centered = false, file = false, width = NODE_WIDTH } = {}): WrappedLabel {
  const inner = width - 2 * LABEL_PAD - (hexagon ? 2 * HEX_ROOM : 0);
  const titleOf = file ? (s: string) => metaWidth(s, FILE_FONT) * WIDTH_MARGIN : (s: string) => titleWidth(s) * WIDTH_MARGIN;
  return {
    title: wrapText(lines.title, inner, titleOf, file ? '/-' : '-'),
    meta: wrapText(lines.meta, inner - (marked ? (centered ? 2 : 1) * BADGE_ROOM : 0), (s) => metaWidth(s) * WIDTH_MARGIN, '-'),
    file,
  };
}

/** How tall a box must be for its wrapped label at text scale 1: its lines, the padding above and below, and the border. */
export const labelHeight = (label: WrappedLabel) =>
  2 * (LABEL_PAD_BLOCK + BORDER) + LINE_HEIGHT * (label.meta.length * META_FONT + label.title.length * (label.file ? FILE_FONT : TITLE_FONT));

const wrapCache = new WeakMap<SpecIndex, Map<string, WrappedLabel>>();
/** A node's label broken into lines, centered or not, cached per index: what the map sizes a box for and the page draws. */
export function labelFor(index: SpecIndex, id: string, centered: boolean): WrappedLabel {
  let cache = wrapCache.get(index);
  if (!cache) { cache = new Map(); wrapCache.set(index, cache); }
  const key = `${centered ? 'c' : 'l'}${id}`;
  const known = cache.get(key);
  if (known) return known;
  const label = wrapLabel(labelLines(index, id), { hexagon: index.byId.get(id)?.kind === 'domain', marked: hasMarks(index, id), centered, file: id.startsWith('file:') });
  cache.set(key, label);
  return label;
}

/** A level's text scale (LA-EXP-DR58): its width over a leaf level's. Every box in the level has it; fixed by the map, never by the camera. */
export const textScaleOf = (w: number) => Math.max(1, w / NODE_WIDTH);

// ---------- The Nested and Voronoi maps' labels ----------

/** In the Nested and Voronoi maps, each nesting level's text is this many times the level's below (LA-EXP-DR62, LA-EXP-DR64). */
export const NESTED_LEVEL_STEP = 1.5;
/**
 * A nesting level's text scale in the Nested and Voronoi maps: 1 at the deepest level under the
 * product, NESTED_LEVEL_STEP times the level below's each level up. Every box at one level has it,
 * set when the map is built, never by the focus or the zoom.
 */
export const levelTextScale = (level: number, deepest: number) => NESTED_LEVEL_STEP ** Math.max(0, deepest - level);

/** What a Nested box's or a Voronoi cell's label says, and what it keeps room for: a domain's hexagon mark, the problem badge. */
export interface MapLabel { title: string; meta: string; hexagon?: boolean; marked?: boolean }

/** A label's lines in a box `width` wide at text scale 1 (`wrapLabel`), centered or at the top left. */
export const linesIn = (label: MapLabel, width: number, centered: boolean): WrappedLabel =>
  wrapLabel(label, { hexagon: label.hexagon, marked: label.marked, centered, width });

/** Whether every word of a label fits on a line of a box `width` wide at text scale 1, so wrapping never breaks a word. */
export function wordsFit(label: MapLabel, width: number, centered: boolean): boolean {
  const inner = width - 2 * LABEL_PAD - (label.hexagon ? 2 * HEX_ROOM : 0);
  const words = (text: string) => text.split(/\s+/).filter(Boolean);
  return words(label.title).every((w) => titleWidth(w) * WIDTH_MARGIN <= inner)
    && words(label.meta).every((w) => metaWidth(w) * WIDTH_MARGIN <= inner - (label.marked ? (centered ? 2 : 1) * BADGE_ROOM : 0));
}

/** The shape a label wraps toward for its least box: about 3 wide to 2 tall. */
export const LABEL_ASPECT = 1.5;

/** The narrowest box a label fits at text scale 1: its widest word, its padding and the badge's room. */
export function narrowestWidth(label: MapLabel, centered: boolean): number {
  const words = (text: string, measure: (s: string) => number) => text.split(/\s+/).filter(Boolean).map((w) => measure(w) * WIDTH_MARGIN);
  const badge = label.marked ? (centered ? 2 : 1) * BADGE_ROOM : 0;
  return 2 * LABEL_PAD + (label.hexagon ? 2 * HEX_ROOM : 0) + Math.max(1, ...words(label.title, titleWidth), ...words(label.meta, metaWidth).map((w) => w + badge));
}

/**
 * The least box a label needs at text scale 1: wrapped on whole words in the width, from the
 * narrowest its words allow to one line, whose shape is nearest LABEL_ASPECT. At a level's text
 * scale it is this box times the scale.
 */
export function labelBox(label: MapLabel, centered: boolean): { w: number; h: number } {
  const pad = 2 * LABEL_PAD + (label.hexagon ? 2 * HEX_ROOM : 0);
  const narrowest = narrowestWidth(label, centered);
  const badge = label.marked ? (centered ? 2 : 1) * BADGE_ROOM : 0;
  const widest = Math.max(narrowest, pad + Math.max(titleWidth(label.title), metaWidth(label.meta) + badge) * WIDTH_MARGIN + 1);
  let best = { w: widest, h: labelHeight(linesIn(label, widest, centered)) };
  for (let i = 0; i <= 8; i++) {
    const w = narrowest + ((widest - narrowest) * i) / 8;
    const h = labelHeight(linesIn(label, w, centered));
    if (Math.abs(Math.log(w / h / LABEL_ASPECT)) < Math.abs(Math.log(best.w / best.h / LABEL_ASPECT))) best = { w, h };
  }
  return best;
}
