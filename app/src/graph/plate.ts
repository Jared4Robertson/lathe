import { kindLabel, type SpecIndex } from '../specs/data';
import { groupKindLabel, stageFor, type BoxStage } from './model';
import type { MapNode } from './map';
import type { NestedNode } from './nested';
import { treeGroup } from './tree';
import { nodeShape, outlineOf, SHAPES, type Mark, type Outline, type Shape } from './shapes';
import {
  BORDER, LABEL_PAD, LABEL_PAD_BLOCK, labelLines, LINE_HEIGHT, META_FONT,
  marksOf, textMeasure, TITLE_FONT, type Face, type WrappedLabel,
} from './text';

// A box as the canvas draws it (LA-EXP-DS06, LA-V93-R06): its outline, its colors' roles and,
// placed once in map units, its label's lines, its marks and its problem badges. Nothing here
// depends on the camera: the canvas draws a plate's lines at their map size times the zoom
// (paint.ts), so a label keeps its size in the map and is crisp at any zoom. A plate is made once
// per map and node, from the lines the map broke its label into.

/** How a box is drawn: a Tree box in its kind's shape, a Nested box, or a Trace stage's box in its kind's shape. */
export type PlateView = 'tree' | 'nested' | 'trace';

/** One line of a label, at its place in the map: its text as the map broke it (a space it ends with is not drawn), its left end and baseline, its font size, and its width in map units. */
export interface PlateLine { text: string; face: Face; size: number; x: number; baseline: number; top: number; height: number; width: number; tone: 'ink' | 'muted' }
/** A small drawing before the kind and ID line: a shape's mark (Nested) or a kind's mark. */
export interface PlateIcon { draw: 'shape' | 'mark'; name: Shape | Mark; x: number; y: number; w: number; h: number }
/** The problem badges' tones, by their swatches in the graph's key: errors, warnings, coverage gaps. */
export const BADGE_TONES = ['error', 'warning', 'gap'] as const;
/** A problem badge: "!" for errors or warnings, "gap" for coverage gaps. */
export interface PlateBadge { label: string; tone: (typeof BADGE_TONES)[number]; x: number; y: number; w: number; h: number; size: number }

export interface Plate {
  id: string;
  /**
   * Its place in the map, unique among the frame's plates: what the fade and the spotlight light (fade.ts). Its ID on
   * the graph, where each record has one place; a Trace stage's box's key, a record there having a box in each lane.
   */
  place: string;
  kind: string;
  /** The kind's name ("Use case"), or "Group". */
  kindLabel: string;
  title: string;
  /** The line above the title: "Use case · LA-EXP-UC03", "Group · LA-EXP". */
  meta: string;
  stage: BoxStage;
  group: boolean;
  shape: Shape;
  view: PlateView;
  /** Its box in the map. */
  x: number; y: number; w: number; h: number;
  /** Its border's and outline's scale, and its text's. */
  scale: number;
  text: number;
  /** Its outline: its kind's shape in the Tree view, a box in the Nested view. */
  outline: Outline;
  /** Whether its edge is drawn inside its outline in the state's color (a polygon), rather than ringed outside it. */
  edged: boolean;
  /** Its border's width and whether it is dashed (an open question). */
  border: number;
  dashed: boolean;
  /** What its shape draws inside its outline, in the Tree view. */
  decoration: Shape | null;
  /** Where its label lies (its content box). */
  label: { x: number; y: number; w: number; h: number };
  lines: PlateLine[];
  icons: PlateIcon[];
  badges: PlateBadge[];
  /** The marks' counts, for the accessible description. */
  errors: number;
  warnings: number;
  gaps: string[];
}

/** The size of an icon before the kind and ID line, at text scale 1: a shape's 14 by 10, a mark's 10 by 10, and the gap after each. */
const ICON = { shape: { w: 14, h: 10 }, mark: { w: 10, h: 10 }, gap: 4, drop: 1.5 };
/** A badge at text scale 1: its height and least width, its padding, its font, the gap between two, and its offset from the top right. */
const BADGE = { h: 15, minW: 15, pad: 3, font: 9.5, gap: 3, top: 3, right: 8 };

interface Place {
  lines: WrappedLabel;
  /** The box the label is placed in: its content box. */
  box: { left: number; right: number; top: number; bottom: number };
  centered: boolean;
  /** Its lines start at the top of the box (a Nested parent's header), rather than in the middle. */
  top: boolean;
  t: number;
  icons: { draw: 'shape' | 'mark'; name: Shape | Mark }[];
  /** Muted lines after the title (a Trace stage's box: the outcomes a capability serves, how many lanes hold a record). */
  notes?: readonly string[];
}

/** A label's lines placed in its box, as a column of lines centered or at the left, its icons before the first kind and ID line. */
function placeLines({ lines, box, centered, top, t, icons, notes = [] }: Place): { lines: PlateLine[]; icons: PlateIcon[] } {
  const m = textMeasure();
  const all = [
    ...lines.meta.map((text) => ({ text, face: 'meta' as Face, size: META_FONT * t, tone: 'muted' as const })),
    ...lines.title.map((text) => ({ text, face: 'title' as Face, size: TITLE_FONT * t, tone: 'ink' as const })),
    ...notes.map((text) => ({ text, face: 'meta' as Face, size: META_FONT * t, tone: 'muted' as const })),
  ];
  const height = all.reduce((s, l) => s + l.size * LINE_HEIGHT, 0);
  let y = top ? box.top : box.top + (box.bottom - box.top - height) / 2;
  const cx = (box.left + box.right) / 2;
  const iconRun = icons.reduce((s, i) => s + (ICON[i.draw].w + ICON.gap) * t, 0);
  const out: PlateLine[] = [];
  const placedIcons: PlateIcon[] = [];
  all.forEach((l, i) => {
    const lh = l.size * LINE_HEIGHT;
    const { ascent, descent } = m.metrics(l.face);
    const baseline = y + (lh - (ascent + descent) * l.size) / 2 + ascent * l.size;
    const width = m.em(l.text.trimEnd(), l.face) * l.size;
    const lead = i === 0 && lines.meta.length > 0 ? iconRun : 0;
    const left = centered ? cx - (lead + width) / 2 : box.left;
    if (lead > 0) {
      let x = left;
      for (const icon of icons) {
        const size = ICON[icon.draw];
        placedIcons.push({ draw: icon.draw, name: icon.name, x, y: baseline + ICON.drop * t - size.h * t, w: size.w * t, h: size.h * t });
        x += (size.w + ICON.gap) * t;
      }
    }
    out.push({ text: l.text, face: l.face, size: l.size, x: left + lead, baseline, top: y, height: lh, width, tone: l.tone });
    y += lh;
  });
  return { lines: out, icons: placedIcons };
}

/** A box's problem badges, right to left from their right edge at a top. */
function badgesAt(marks: { errors: number; warnings: number; gaps: string[] }, right: number, top: number, t: number): PlateBadge[] {
  const pills: { label: string; tone: PlateBadge['tone'] }[] = [];
  if (marks.errors > 0) pills.push({ label: '!', tone: 'error' });
  else if (marks.warnings > 0) pills.push({ label: '!', tone: 'warning' });
  if (marks.gaps.length > 0) pills.push({ label: 'gap', tone: 'gap' });
  const m = textMeasure();
  const widths = pills.map((p) => Math.max(BADGE.minW, m.em(p.label, 'badge') * BADGE.font + 2 * BADGE.pad) * t);
  let x = right - widths.reduce((s, w) => s + w, 0) - BADGE.gap * t * (pills.length - 1);
  return pills.map((p, i) => {
    const badge = { ...p, x, y: top, w: widths[i], h: BADGE.h * t, size: BADGE.font * t };
    x += widths[i] + BADGE.gap * t;
    return badge;
  });
}

/**
 * What a Trace stage box is when it is no record (a file, a gap, the Untraced lane's head): its kind, its words and its
 * colors' role. It is drawn as a plain box, dashed when it is a gap.
 */
export interface PlainBox { kind: string; kindLabel: string; title: string; meta: string; stage: BoxStage; dashed: boolean }

/** Where a box's map node, a Nested one, or a Trace stage's box comes from. */
export type PlateSource =
  | { view: 'tree'; node: MapNode }
  | { view: 'nested'; node: NestedNode }
  /**
   * A Trace stage's box (LA-V98), at text scale 1: its lines, already wrapped and cut to its box, at its top when it
   * spans several lanes; its notes after them; `plain` for a box that is no record.
   */
  | { view: 'trace'; place: string; node: { x: number; y: number; w: number; h: number }; lines: WrappedLabel; notes: readonly string[]; top: boolean; plain?: PlainBox };

/** A box's plate: its outline, colors' roles, and its label placed in it (LA-EXP-DS06, LA-EXP-DS07, LA-V93-R06). */
export function plateOf(index: SpecIndex, id: string, source: PlateSource): Plate {
  if (source.view === 'trace') return tracePlate(index, id, source);
  const { x, y, w, h, text: t } = source.node;
  const record = index.byId.get(id);
  const words = labelLines(index, id);
  const kind = record ? record.kind : treeGroup(index, id)?.kind ?? 'folder';
  const { shape, mark } = nodeShape(index, id);
  const stage = stageFor(index, id, kind);
  const marks = marksOf(index, id);
  const marked = marks.errors + marks.warnings + marks.gaps.length > 0;
  const base = {
    id, place: id, kind, kindLabel: record ? kindLabel(index, record.kind) : groupKindLabel(index, id), title: words.title, meta: words.meta,
    stage, group: !record, shape, view: source.view, x, y, w, h, text: t, ...marks,
    dashed: kind === 'question',
  };

  if (source.view === 'tree') {
    // Its kind's shape is its outline (LA-V93-R06); a polygon's edge is drawn inside it, so it has no border to pad past.
    // Its border grows with its text (LA-EXP-DS06): its box scale is its text scale.
    const scale = t;
    const outline = outlineOf(shape, { x, y, w, h }, scale);
    const edged = outline.kind === 'polygon';
    const border = (shape === 'product' ? 2.5 : BORDER) * scale;
    const inset = edged ? 0 : border;
    const { room } = SHAPES[shape];
    // The lines its map broke its label into, centered or not.
    const { centered, lines } = source.node;
    const box = { left: x + inset + (LABEL_PAD + room.l) * t, right: x + w - inset - (LABEL_PAD + room.r) * t, top: y + inset + (LABEL_PAD_BLOCK + room.t) * t, bottom: y + h - inset - (LABEL_PAD_BLOCK + room.b) * t };
    const placed = placeLines({ lines, box, centered, top: false, t, icons: mark ? [{ draw: 'mark', name: mark }] : [] });
    // Its badge sits at its top right, inside its shape's room.
    const badges = !marked ? [] : badgesAt(marks, x + w - inset - (BADGE.right + room.r) * t, y + inset + (BADGE.top + room.t) * t, t);
    return { ...base, scale, outline, edged, border, decoration: shape, label: { x: box.left, y: box.top, w: box.right - box.left, h: box.bottom - box.top }, lines: placed.lines, icons: placed.icons, badges };
  }

  // Nested (LA-EXP-DS07): its border grows with its text; its shape is a mark before its kind and ID line.
  const n = source.node;
  const scale = Math.max(0.5, t);
  const border = BORDER * scale;
  const icons: Place['icons'] = [{ draw: 'shape' as const, name: shape }, ...(mark ? [{ draw: 'mark' as const, name: mark }] : [])];
  const box = { left: x + border + LABEL_PAD * t, right: x + w - border - LABEL_PAD * t, top: y + border + LABEL_PAD_BLOCK * t, bottom: n.header > 0 ? y + n.header - border - LABEL_PAD_BLOCK * t : y + h - border - LABEL_PAD_BLOCK * t };
  const placed = placeLines({ lines: n.lines, box, centered: n.centered, top: n.header > 0, t, icons });
  const outline = outlineOf('box', { x, y, w, h }, scale);
  const badges = marked ? badgesAt(marks, x + w - border - BADGE.right * t, y + border + BADGE.top * t, t) : [];
  return { ...base, scale, outline, edged: false, border, decoration: null, label: { x: box.left, y: box.top, w: box.right - box.left, h: box.bottom - box.top }, lines: placed.lines, icons: placed.icons, badges };
}

/** A Trace stage's box: a record in its kind's shape, or a plain box, at text scale 1, its lines as given. */
function tracePlate(index: SpecIndex, id: string, source: Extract<PlateSource, { view: 'trace' }>): Plate {
  const { x, y, w, h } = source.node;
  const { plain } = source;
  const record = plain ? undefined : index.byId.get(id);
  const { shape, mark } = plain ? { shape: 'box' as Shape, mark: undefined } : nodeShape(index, id);
  const kind = plain ? plain.kind : record?.kind ?? 'folder';
  const words = plain ?? labelLines(index, id);
  const marks = plain ? { errors: 0, warnings: 0, gaps: [] } : marksOf(index, id);
  const marked = marks.errors + marks.warnings + marks.gaps.length > 0;
  const outline = outlineOf(shape, { x, y, w, h }, 1);
  const edged = outline.kind === 'polygon';
  const inset = edged ? 0 : BORDER;
  const { room } = SHAPES[shape];
  const box = { left: x + inset + LABEL_PAD + room.l, right: x + w - inset - LABEL_PAD - room.r, top: y + inset + LABEL_PAD_BLOCK + room.t, bottom: y + h - inset - LABEL_PAD_BLOCK - room.b };
  const placed = placeLines({ lines: source.lines, box, centered: false, top: source.top, t: 1, icons: mark ? [{ draw: 'mark', name: mark }] : [], notes: source.notes });
  const badges = marked ? badgesAt(marks, x + w - inset - BADGE.right - room.r, y + inset + BADGE.top + room.t, 1) : [];
  return {
    id, place: source.place, kind, kindLabel: plain ? plain.kindLabel : record ? kindLabel(index, record.kind) : groupKindLabel(index, id), title: words.title, meta: words.meta,
    stage: plain ? plain.stage : stageFor(index, id, kind), group: !plain && !record, shape, view: 'trace', x, y, w, h, text: 1, scale: 1, ...marks,
    dashed: plain ? plain.dashed : kind === 'question', outline, edged, border: BORDER, decoration: shape,
    label: { x: box.left, y: box.top, w: box.right - box.left, h: box.bottom - box.top }, lines: placed.lines, icons: placed.icons, badges,
  };
}

/** The accessible name of a box: "Use case (center) Browse the map", "Stage Use cases (4) in LA-EXP". */
export function plateName(p: Plate, isFocus: boolean): string {
  if (p.group) return `${p.kindLabel} ${p.title} in ${groupOwnerOf(p)}${isFocus ? ' (center)' : ''}`;
  return `${p.kindLabel} ${isFocus ? '(center) ' : ''}${p.title}`;
}

/** A group's owner, the end of its kind line ("Stage · LA-EXP"). */
const groupOwnerOf = (p: Plate) => p.meta.split(' · ').at(-1) ?? '';

/** A box's tooltip: "title (ID)", or a group's "title (in owner)". */
export const plateTip = (p: Plate) => (p.group ? `${p.title} (in ${groupOwnerOf(p)})` : `${p.title} (${p.id})`);
