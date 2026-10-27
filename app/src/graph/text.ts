import { kindLabel, type SpecIndex } from '../specs/data';
import { NODE_WIDTH } from './layout';
import { gapsFor, groupLabel, groupMarks, groupOwner } from './model';
import { nodeShape, SHAPES, type Room, type Shape } from './shapes';

// A box's label as part of the map (LA-EXP-DR58): its two lines, the kind and ID line and the
// title, are sized once, in map units, by its level's text scale (the level's width over a leaf's),
// and never change size relative to the box; only the camera changes how big they look. A long
// title wraps on whole words, never cut off or ended with an ellipsis, and a leaf grows taller to
// fit it. Lines are broken here, with the text measure the canvas draws with (the label's faces,
// loaded, measured by the canvas's own text metrics: fonts.ts), once when the map is built, so the
// map is laid out once per spec load and the canvas draws exactly these lines (paint.ts).

/** A label's font sizes and padding at text scale 1 (a leaf-wide level), in map units; the canvas draws them with these. */
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

/** The faces the graph draws text in: a title (the body face at 600), a kind and ID line or a file's title (the mono face), a problem badge (mono at 700), a link's words (mono). */
export type Face = 'title' | 'meta' | 'badge' | 'edge';

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
/** A kind and ID line's (or a file's title's) width at a font size. */
export const metaWidth = (text: string, font = META_FONT) => current.em(text, 'meta') * font;

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


/** A label's lines, as the canvas draws them: it wraps nothing itself. */
export interface WrappedLabel {
  title: string[];
  meta: string[];
  file: boolean;
  /** The height its shape keeps clear above and below it, at text scale 1 (LA-EXP-DR65): none for a box. */
  pad?: number;
}

/** Whether a box's label is centered (LA-EXP-DR58): a parent's always, and a leaf's in a level wider than a leaf. */
export const isCentered = (text: number, parent: boolean) => parent || text !== 1;

/** What a label keeps room for besides its padding: its shape's room (the Tree view), the marks before its kind and ID line, the problem badge. */
interface LabelRoom { shape?: Shape; marks?: number; marked?: boolean; centered?: boolean }

const NO_ROOM: Room = { l: 0, r: 0, t: 0, b: 0 };

/** How much less a kind and ID line holds than a title: the marks before it, and the badge's room beside it (on both sides once centered). */
const metaRoom = ({ marks = 0, marked = false, centered = false }: LabelRoom) => marks * MARK_ROOM + (marked ? (centered ? 2 : 1) * BADGE_ROOM : 0);

/**
 * A label broken into lines for its box (LA-EXP-DR58). Wrapping is the same at every text scale (a
 * level's width and its text grow together), so lines are broken once, at text scale 1 in a leaf's
 * width (or `width`, a Nested box's width over its text scale), less the padding, its shape's room
 * (LA-EXP-DR65), and beside the kind and ID line its marks and the badge's room.
 */
export function wrapLabel(lines: { title: string; meta: string }, { shape, marks = 0, marked = false, centered = false, file = false, width = NODE_WIDTH }: LabelRoom & { file?: boolean; width?: number } = {}): WrappedLabel {
  const room = shape ? SHAPES[shape].room : NO_ROOM;
  const inner = width - 2 * LABEL_PAD - room.l - room.r;
  const titleOf = file ? (s: string) => metaWidth(s, FILE_FONT) : (s: string) => titleWidth(s);
  const label: WrappedLabel = {
    title: wrapText(lines.title, inner, titleOf, file ? '/-' : '-'),
    meta: wrapText(lines.meta, inner - metaRoom({ marks, marked, centered }), (s) => metaWidth(s), '-'),
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

const wrapCache = new WeakMap<SpecIndex, Map<string, WrappedLabel>>();
/** A node's label broken into lines, centered or not, cached per index and measure: what the map sizes a box for and the canvas draws. */
export function labelFor(index: SpecIndex, id: string, centered: boolean): WrappedLabel {
  let cache = wrapCache.get(index);
  if (!cache) { cache = new Map(); wrapCache.set(index, cache); }
  const key = `${current.key}|${centered ? 'c' : 'l'}${id}`;
  const known = cache.get(key);
  if (known) return known;
  const { shape, mark } = nodeShape(index, id);
  const label = wrapLabel(labelLines(index, id), { shape, marks: mark ? 1 : 0, marked: hasMarks(index, id), centered, file: id.startsWith('file:') });
  cache.set(key, label);
  return label;
}

/** A level's text scale (LA-EXP-DR58): its width over a leaf level's. Every box in the level has it; fixed by the map, never by the camera. */
export const textScaleOf = (w: number) => Math.max(1, w / NODE_WIDTH);

// ---------- The Nested map's labels ----------

/** What a Nested or Voronoi box's label says, and what it keeps room for: the marks before its kind and ID line (its shape's, and a gear or a ruler), the problem badge. */
export interface MapLabel { title: string; meta: string; marks?: number; marked?: boolean }

/** A node's label in the Nested and Voronoi maps: its lines, its marks (its shape's and its kind's, LA-EXP-DR65) and whether it has the badge. */
export function mapLabel(index: SpecIndex, id: string): MapLabel {
  const marks = id.startsWith('file:') ? 0 : nodeShape(index, id).mark ? 2 : 1;
  return { ...labelLines(index, id), marks, marked: hasMarks(index, id) };
}

/** A label's lines in a box `width` wide at text scale 1 (`wrapLabel`), centered or at the top left. */
export const linesIn = (label: MapLabel, width: number, centered: boolean): WrappedLabel =>
  wrapLabel(label, { marks: label.marks, marked: label.marked, centered, width });

/** Whether every word of a label fits on a line of a box `width` wide at text scale 1, so wrapping never breaks a word. */
export function wordsFit(label: MapLabel, width: number, centered: boolean): boolean {
  const inner = width - 2 * LABEL_PAD;
  const words = (text: string) => text.split(/\s+/).filter(Boolean);
  return words(label.title).every((w) => titleWidth(w) <= inner)
    && words(label.meta).every((w) => metaWidth(w) <= inner - metaRoom({ ...label, centered }));
}

/** The narrowest box a label fits at text scale 1: its widest word, its padding and the badge's room. */
export function narrowestWidth(label: MapLabel, centered: boolean): number {
  const words = (text: string, measure: (s: string) => number) => text.split(/\s+/).filter(Boolean).map((w) => measure(w));
  const room = metaRoom({ ...label, centered });
  return 2 * LABEL_PAD + Math.max(1, ...words(label.title, titleWidth), ...words(label.meta, metaWidth).map((w) => w + room));
}
