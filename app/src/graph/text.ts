import { kindLabel, type SpecIndex } from '../specs/data';
import { NODE_HEIGHT } from './layout';
import { gapsFor, groupLabel, groupMarks, groupOwner } from './model';

// A box's label as part of the map (LA-EXP-DR58): its two lines, the kind and ID line and the
// title, are sized once, in map units, in proportion to the box's height, and never change size
// relative to the box; only the camera changes how big they look. A level is wide enough for the
// widest label in it on one line, so no title is ever cut off or wrapped. Widths are estimated
// from a table of character widths, never measured in the page, so the map is laid out once.

/** A label's font sizes and padding at text scale 1 (a leaf), in map units; the stylesheet draws them with these. */
export const TITLE_FONT = 12.5;
export const META_FONT = 10.5;
/** The padding on each side of a label, and the room kept beside the kind and ID line for the problem badge. */
export const LABEL_PAD = 14;
export const BADGE_ROOM = 30;
/** A hexagon (a domain, LA-EXP-DR61) keeps its chamfer clear of its label too, at most this at text scale 1. */
export const HEX_ROOM = 12;
/** The estimate errs wide by this much, so a label never clips whatever face draws it. */
export const WIDTH_MARGIN = 1.05;
/** Below this many pixels of title text on screen, a box draws no label, only its shape (LA-EXP-DR60). */
export const MIN_LABEL_PX = 7;

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
/** A kind and ID line's estimated width at a font size. */
export const metaWidth = (text: string, font = META_FONT) => [...text].length * MONO_EM * font;

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

/**
 * How wide a box must be for its label on one line at text scale 1, its padding included: the
 * wider of its title and its kind and ID line (with room on both sides for the problem badge when it
 * has one), erring wide. A domain's hexagon keeps its chamfer clear as well.
 */
export function labelWidth(lines: { title: string; meta: string }, { hexagon = false, marked = false } = {}): number {
  const text = Math.max(titleWidth(lines.title), metaWidth(lines.meta) + (marked ? 2 * BADGE_ROOM : 0));
  return Math.ceil(text * WIDTH_MARGIN + 2 * LABEL_PAD + (hexagon ? 2 * HEX_ROOM : 0));
}

/** A box's text scale (LA-EXP-DR58): its height over a leaf's, so its label keeps a leaf's proportions. Fixed by the map, never by the camera. */
export const textScaleOf = (h: number) => Math.max(1, h / NODE_HEIGHT);

/** Whether a box's label is drawn at a zoom (LA-EXP-DR60): its title at least MIN_LABEL_PX on screen. It only shows or hides the label, never resizes it. */
export const labelShown = (h: number, zoom: number) => TITLE_FONT * textScaleOf(h) * zoom >= MIN_LABEL_PX;
