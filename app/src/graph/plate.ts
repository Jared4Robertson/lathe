import { kindLabel, type RecordIndex } from '../exploring/record-summaries/record-index';
import { groupKindLabel, groupName, stageFor, type BoxStage } from './model';
import type { MapNode } from './map';
import type { NestedNode } from './nested';
import { FAR_TEXT, type GroundNode } from './ground';
import { countOf } from '../plural';
import { treeGroup } from './tree';
import { nodeShape, outlineOf, SHAPES, type Mark, type Outline, type Shape } from './shapes';
import {
  BORDER, EYEBROW_FONT, EYEBROW_GAP, eyebrowRuns, LABEL_PAD, LABEL_PAD_BLOCK, labelLines, LINE_HEIGHT,
  marksOf, NODE_TEXT, STATUS_FONT, textMeasure, TITLE_FONT, type Face, type WrappedLabel,
} from './text';

// A box as the canvas draws it (LA-EXP-DS06, LA-V93-R06): its outline, its colors' roles and,
// placed once in map units, its label's lines, its marks and its problem badges. Nothing here
// depends on the camera: the canvas draws a plate's lines at their map size times the zoom
// (paint.ts), so a label keeps its size in the map and is crisp at any zoom. A plate is made once
// per map and node, from the lines the map broke its label into.

/** How a box is drawn: a Tree box in its kind's shape (the Graph's and the Trace stage's), a Nested box, or a Map box or area. */
export type PlateView = 'tree' | 'nested' | 'map';

/**
 * One run of a label's line, at its place in the map: its text as the map broke it (a space it ends with is not drawn),
 * its face, its left end and baseline, its font size, its width in map units, and its level in the node text scale
 * (text.ts NODE_TEXT). A title line is one run; an eyebrow or status line one run per face (its words, a record ID).
 */
export interface PlateLine { text: string; face: Face; size: number; x: number; baseline: number; top: number; height: number; width: number; level: 'title' | 'eyebrow' | 'status'; tone: 'ink' | 'muted' }
/** A small drawing before the eyebrow: a shape's mark (Nested) or a kind's mark. */
export interface PlateIcon { draw: 'shape' | 'mark'; name: Shape | Mark; x: number; y: number; w: number; h: number }
/** The problem badges' tones, by their swatches in the graph's key: errors, warnings, coverage gaps. */
export const BADGE_TONES = ['error', 'warning', 'gap'] as const;
/** A problem badge: "!" for errors or warnings, "gap" for coverage gaps. */
export interface PlateBadge { label: string; tone: (typeof BADGE_TONES)[number]; x: number; y: number; w: number; h: number; size: number }

export interface Plate {
  id: string;
  /**
   * Its place in the map, unique among the frame's plates: what the fade and the spotlight light (fade.ts). Its ID on
   * the graph, where each record has one place; a Trace stage's node's key, a record there having a node in each chain.
   */
  place: string;
  kind: string;
  /** The kind's name ("Use case"), or "Group". */
  kindLabel: string;
  title: string;
  /** The eyebrow above the title as it is drawn: "Use case · LA-EXP-UC03", "Stage · LA-EXP", an ID alone where a band names its kind. */
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
  /** Where its label lies (its content box), and whether its lines are centered in it rather than set at its left. */
  label: { x: number; y: number; w: number; h: number };
  centered: boolean;
  lines: PlateLine[];
  icons: PlateIcon[];
  badges: PlateBadge[];
  /**
   * A Map's ground, district, neighborhood or area (ground.ts): drawn as a labeled area, not a box, its name and its count
   * of records at one size on screen whatever the zoom (paint.ts), as a map labels its places; null for a box.
   */
  area: { role: 'ground' | 'district' | 'neighborhood' | 'area'; name: string; count: string } | null;
  /**
   * A Map's leaf record's label from afar (LA-EXP-DS12): the same plate with its title alone at a larger text scale,
   * drawn where its own title would read under the readable size (paint.ts labelPlate); null for every other box.
   */
  far: Plate | null;
  /** The marks' counts, for the accessible description. */
  errors: number;
  warnings: number;
  gaps: string[];
}

/** The size of an icon before the eyebrow, at text scale 1: a shape's 14 by 10, a mark's 10 by 10, and the gap after each. */
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
}

/**
 * A label's lines placed in its box, as a column of lines centered or at the left, its icons before the first eyebrow
 * line: each eyebrow line drawn as its runs (text.ts eyebrowRuns), side by side on one baseline.
 */
function placeLines({ lines, box, centered, top, t, icons }: Place): { lines: PlateLine[]; icons: PlateIcon[] } {
  const m = textMeasure();
  const all = [
    ...lines.meta.map((text) => ({ text, level: 'eyebrow' as const, size: EYEBROW_FONT * t })),
    ...lines.title.map((text) => ({ text, level: 'title' as const, size: TITLE_FONT * t })),
    ...(lines.status ?? []).map((text) => ({ text, level: 'status' as const, size: STATUS_FONT * t })),
  ];
  const gap = lines.meta.length > 0 ? EYEBROW_GAP * t : 0;
  const height = all.reduce((s, l) => s + l.size * LINE_HEIGHT, 0) + gap;
  let y = top ? box.top : box.top + (box.bottom - box.top - height) / 2;
  const cx = (box.left + box.right) / 2;
  const iconRun = icons.reduce((s, i) => s + (ICON[i.draw].w + ICON.gap) * t, 0);
  const out: PlateLine[] = [];
  const placedIcons: PlateIcon[] = [];
  all.forEach((l, i) => {
    const lh = l.size * LINE_HEIGHT;
    const tone = NODE_TEXT[l.level].tone;
    const runs = l.level === 'title' ? [{ text: l.text, face: 'title' as Face }] : eyebrowRuns(l.text);
    const last = runs.length - 1;
    const widths = runs.map((r, k) => m.em(k === last ? r.text.trimEnd() : r.text, r.face) * l.size);
    const width = widths.reduce((s, w) => s + w, 0);
    // The line's baseline, from its level's face: an eyebrow's runs share one, whatever their faces.
    const { ascent, descent } = m.metrics(l.level === 'title' ? 'title' : 'eyebrow');
    const baseline = y + (lh - (ascent + descent) * l.size) / 2 + ascent * l.size;
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
    let x = left + lead;
    runs.forEach((r, k) => {
      out.push({ text: r.text, face: r.face, size: l.size, x, baseline, top: y, height: lh, width: widths[k], level: l.level, tone });
      x += widths[k];
    });
    y += lh + (i === lines.meta.length - 1 ? gap : 0);
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
 * What a Trace stage box is when it is no record (a gap): its kind, its words and its colors' role. It is drawn as a
 * plain box, dashed when it is a gap.
 */
export interface PlainBox { kind: string; kindLabel: string; title: string; meta: string; status?: string; stage: BoxStage; dashed: boolean }

/**
 * Where a box comes from: a Tree map's node (the Graph's, or a Trace stage box, LA-V98, where `place` is its key and
 * `plain` says what a box that is no record is), or a Nested one.
 */
export type PlateSource =
  | { view: 'tree'; node: MapNode; place?: string; plain?: PlainBox }
  | { view: 'nested'; node: NestedNode }
  | { view: 'map'; node: GroundNode };

/** The corner radius of a Map's area, in map units. */
const AREA_RADIUS = 18;

/** A box's plate: its outline, colors' roles, and its label placed in it (LA-EXP-DS06, LA-EXP-DS07, LA-V93-R06). */
export function plateOf(index: RecordIndex, id: string, source: PlateSource): Plate {
  const { x, y, w, h, text: t } = source.node;
  const plain = source.view === 'tree' ? source.plain : undefined;
  const record = plain ? undefined : index.byId.get(id);
  const words = plain ?? labelLines(index, id);
  // The eyebrow as the map broke it: an ID alone where a band names the box's kind (text.ts mapLabel).
  const shown = source.view === 'map' && source.node.role !== 'record' ? words.meta : source.node.lines.meta.join('');
  const kind = plain ? plain.kind : record ? record.kind : treeGroup(index, id)?.kind ?? 'folder';
  const { shape, mark } = plain ? { shape: 'box' as Shape, mark: undefined } : nodeShape(index, id);
  const stage = plain ? plain.stage : stageFor(index, id, kind);
  const marks = plain ? { errors: 0, warnings: 0, gaps: [] as string[] } : marksOf(index, id);
  const marked = marks.errors + marks.warnings + marks.gaps.length > 0;
  const base = {
    id, place: (source.view === 'tree' ? source.place : undefined) ?? id, kind,
    kindLabel: plain ? plain.kindLabel : record ? kindLabel(index, record.kind) : groupKindLabel(index, id), title: words.title, meta: shown || words.meta,
    stage, group: !plain && !record, shape, view: source.view, x, y, w, h, text: t, ...marks,
    dashed: plain ? plain.dashed : kind === 'question', area: null, far: null,
  };

  if (source.view === 'map' && source.node.role !== 'record') {
    // A Map's area (LA-EXP-DS12): a soft rounded ground, its name and count drawn at one size on screen (paint.ts); its
    // badges at its top right, at street level.
    const n = source.node;
    const role = n.role as 'ground' | 'district' | 'neighborhood' | 'area';
    const r = Math.min(AREA_RADIUS, w / 2, h / 2);
    const name = record ? record.title : groupName(index, id);
    const badges = marked ? badgesAt(marks, x + w - BADGE.right, y + BADGE.top, 1) : [];
    return {
      ...base, scale: 1, outline: { kind: 'round', rx: r, ry: r }, edged: false, border: BORDER, decoration: null,
      label: { x: x + LABEL_PAD, y, w: Math.max(0, w - 2 * LABEL_PAD), h: n.header }, centered: false, lines: [], icons: [], badges,
      area: { role, name, count: countOf(n.count, 'record') },
    };
  }

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
    return { ...base, scale, outline, edged, border, decoration: shape, label: { x: box.left, y: box.top, w: box.right - box.left, h: box.bottom - box.top }, centered, lines: placed.lines, icons: placed.icons, badges };
  }

  // Nested (LA-EXP-DS07) and a Map's record (LA-EXP-DS12): its border grows with its text; its shape is a mark before its eyebrow.
  const n = source.node;
  const scale = Math.max(0.5, t);
  const border = BORDER * scale;
  const icons: Place['icons'] = [{ draw: 'shape' as const, name: shape }, ...(mark ? [{ draw: 'mark' as const, name: mark }] : [])];
  const box = { left: x + border + LABEL_PAD * t, right: x + w - border - LABEL_PAD * t, top: y + border + LABEL_PAD_BLOCK * t, bottom: n.header > 0 ? y + n.header - border - LABEL_PAD_BLOCK * t : y + h - border - LABEL_PAD_BLOCK * t };
  const placed = placeLines({ lines: n.lines, box, centered: n.centered, top: n.header > 0, t, icons });
  const outline = outlineOf('box', { x, y, w, h }, scale);
  const badges = marked ? badgesAt(marks, x + w - border - BADGE.right * t, y + border + BADGE.top * t, t) : [];
  const plate: Plate = { ...base, scale, outline, edged: false, border, decoration: null, label: { x: box.left, y: box.top, w: box.right - box.left, h: box.bottom - box.top }, centered: n.centered, lines: placed.lines, icons: placed.icons, badges };
  const far = source.view === 'map' ? source.node.far : null;
  if (!far) return plate;
  // From afar: the title alone at FAR_TEXT, at the box's left as near, its border and badges as they are.
  const f = FAR_TEXT;
  const farBox = { left: x + border + LABEL_PAD * f, right: x + w - border - LABEL_PAD * f, top: y + border + LABEL_PAD_BLOCK * f, bottom: y + h - border - LABEL_PAD_BLOCK * f };
  const farPlaced = placeLines({ lines: far, box: farBox, centered: false, top: false, t: f, icons: [] });
  return { ...plate, far: { ...plate, text: f, label: { x: farBox.left, y: farBox.top, w: farBox.right - farBox.left, h: farBox.bottom - farBox.top }, lines: farPlaced.lines, icons: [] } };
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
