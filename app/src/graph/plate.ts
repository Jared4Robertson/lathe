import { kindLabel, type SpecIndex, type Stage as SchemaStage } from '../specs/data';
import { FILE_KIND, groupKindLabel, stageOf } from './model';
import type { MapNode } from './map';
import type { NestedNode } from './nested';
import type { VoronoiNode } from './voronoi';
import { treeGroup } from './tree';
import { nodeShape, outlineOf, SHAPES, type Mark, type Outline, type Shape } from './shapes';
import {
  BORDER, FILE_FONT, LABEL_PAD, LABEL_PAD_BLOCK, labelFor, labelLines, LINE_HEIGHT, META_FONT,
  marksOf, textMeasure, TITLE_FONT, type Face, type WrappedLabel,
} from './text';

// A box as the canvas draws it (LA-EXP-DR58, LA-EXP-DR65): its outline, its colors' roles and,
// placed once in map units, its label's lines, its marks and its problem badges. Nothing here
// depends on the camera: the canvas draws a plate's lines at their map size times the zoom
// (paint.ts), so a label keeps its size in the map and is crisp at any zoom. A plate is made once
// per map and node, from the lines the map broke its label into.

/** How a box is drawn: a Tree box or a trace's in its kind's shape, a Nested box, a Voronoi cell. */
export type PlateView = 'tree' | 'nested' | 'voronoi' | 'trace';
/** Which colors a box takes: its stage's (a group's too, drawn as a folder), the structural records', a file's. */
export type Stage = SchemaStage | 'structural' | 'file';

/** One line of a label, at its place in the map: its text as the map broke it (a space it ends with is not drawn), its left end and baseline, its font size, and its width in map units. */
export interface PlateLine { text: string; face: Face; size: number; x: number; baseline: number; top: number; height: number; width: number; tone: 'ink' | 'muted' }
/** A small drawing before the kind and ID line: a shape's mark (Nested and Voronoi) or a kind's mark. */
export interface PlateIcon { draw: 'shape' | 'mark'; name: Shape | Mark; x: number; y: number; w: number; h: number }
/** The problem badges' tones, by their swatches in the graph's key: errors, warnings, coverage gaps. */
export const BADGE_TONES = ['error', 'warning', 'gap'] as const;
/** A problem badge: "!" for errors or warnings, "gap" for coverage gaps. */
export interface PlateBadge { label: string; tone: (typeof BADGE_TONES)[number]; x: number; y: number; w: number; h: number; size: number }

export interface Plate {
  id: string;
  kind: string;
  /** The kind's name ("Use case"), or "Group" or "File". */
  kindLabel: string;
  title: string;
  /** The line above the title: "Use case · LA-EXP-UC03", "Group · LA-EXP", "File". */
  meta: string;
  stage: Stage;
  group: boolean;
  file: boolean;
  shape: Shape;
  view: PlateView;
  /** Its box in the map (a Voronoi cell's bounding box). */
  x: number; y: number; w: number; h: number;
  /** Its border's and outline's scale, and its text's. */
  scale: number;
  text: number;
  /** Its outline: its kind's shape in the Tree view and a trace, a box in the Nested view, its polygon in the Voronoi view. */
  outline: Outline;
  /** Whether its edge is drawn inside its outline in the state's color (a polygon, a cell), rather than ringed outside it. */
  edged: boolean;
  /** Its border's width and whether it is dashed (a file, an open question). */
  border: number;
  dashed: boolean;
  /** What its shape draws inside its outline, in the Tree view and a trace. */
  decoration: Shape | null;
  /** Where its label lies (its content box, or a cell's label box). */
  label: { x: number; y: number; w: number; h: number };
  lines: PlateLine[];
  icons: PlateIcon[];
  badges: PlateBadge[];
  /** The marks' counts, for the accessible description. */
  errors: number;
  warnings: number;
  gaps: string[];
}

/**
 * A node's colors: its kind's stage; for a group, the stage it is (a stage group) or its kind's stage (a folder or a
 * record's kind group); the structural colors for what has no stage; a file's.
 */
function stageFor(index: SpecIndex, id: string, kind: string): Stage {
  if (id.startsWith('file:')) return 'file';
  const group = index.byId.has(id) ? undefined : treeGroup(index, id);
  if (group?.role === 'stage') {
    const named = index.workspace.stages.find((s) => s.stage === id.split('/')[1]);
    return named ? named.stage : 'structural';
  }
  const stage = stageOf(index, group ? group.kind ?? '' : kind);
  return stage === '' || stage === 'file' || stage === 'group' ? 'structural' : stage;
}

/** The size of an icon before the kind and ID line, at text scale 1: a shape's 14 by 10, a mark's 10 by 10, and the gap after each. */
const ICON = { shape: { w: 14, h: 10 }, mark: { w: 10, h: 10 }, gap: 4, drop: 1.5 };
/** A badge at text scale 1: its height and least width, its padding, its font, the gap between two, and its offset from the top right. */
const BADGE = { h: 15, minW: 15, pad: 3, font: 9.5, gap: 3, top: 3, right: 8 };
/** A cell's label box's padding at text scale 1. */
const CELL_PAD_BLOCK = 7.5;

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

/** A label's lines placed in its box, as a column of lines centered or at the left, its icons before the first kind and ID line. */
function placeLines({ lines, box, centered, top, t, icons }: Place): { lines: PlateLine[]; icons: PlateIcon[] } {
  const m = textMeasure();
  const all = [
    ...lines.meta.map((text) => ({ text, face: 'meta' as Face, size: META_FONT * t, tone: 'muted' as const })),
    ...lines.title.map((text) => ({ text, face: (lines.file ? 'meta' : 'title') as Face, size: (lines.file ? FILE_FONT : TITLE_FONT) * t, tone: 'ink' as const })),
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

/** Where a box's map node, a Nested one or a Voronoi one, comes from. */
export type PlateSource =
  | { view: 'tree'; node: MapNode }
  | { view: 'trace'; node: Pick<MapNode, 'x' | 'y' | 'w' | 'h' | 'text'> }
  | { view: 'nested'; node: NestedNode }
  | { view: 'voronoi'; node: VoronoiNode };

/** A box's plate: its outline, colors' roles, and its label placed in it (LA-EXP-DR58, LA-EXP-DR62, LA-EXP-DR64, LA-EXP-DR65). `fileTitle` names a file box. */
export function plateOf(index: SpecIndex, id: string, source: PlateSource, fileTitle?: string): Plate {
  const { x, y, w, h, text: t } = source.node;
  const record = index.byId.get(id);
  const file = id.startsWith('file:');
  const words = labelLines(index, id);
  const kind = record ? record.kind : file ? FILE_KIND : treeGroup(index, id)?.kind ?? 'folder';
  const { shape, mark } = nodeShape(index, id);
  const stage = stageFor(index, id, kind);
  const marks = file ? { errors: 0, warnings: 0, gaps: [] } : marksOf(index, id);
  const marked = marks.errors + marks.warnings + marks.gaps.length > 0;
  const base = {
    id, kind, kindLabel: record ? kindLabel(index, record.kind) : file ? 'File' : groupKindLabel(index, id), title: file ? fileTitle ?? words.title : words.title, meta: words.meta,
    stage, group: !record && !file, file, shape, view: source.view, x, y, w, h, text: t, ...marks,
    dashed: file || kind === 'question',
  };

  if (source.view === 'tree' || source.view === 'trace') {
    // Its kind's shape is its outline (LA-EXP-DR65); a polygon's edge is drawn inside it, so it has no border to pad past.
    // Its border grows with its text (LA-EXP-DR58): its box scale is its text scale.
    const scale = t;
    const outline = outlineOf(shape, { x, y, w, h }, scale);
    const edged = outline.kind === 'polygon';
    const border = (shape === 'product' ? 2.5 : BORDER) * scale;
    const inset = edged ? 0 : border;
    const { room } = SHAPES[shape];
    // The lines its map broke its label into, centered or not; a trace's box's from text.ts, at the top left.
    const centered = source.view === 'trace' ? false : source.node.centered;
    const lines = source.view === 'trace' ? labelFor(index, id) : source.node.lines;
    const box = { left: x + inset + (LABEL_PAD + room.l) * t, right: x + w - inset - (LABEL_PAD + room.r) * t, top: y + inset + (LABEL_PAD_BLOCK + room.t) * t, bottom: y + h - inset - (LABEL_PAD_BLOCK + room.b) * t };
    const placed = placeLines({ lines, box, centered, top: false, t, icons: mark ? [{ draw: 'mark', name: mark }] : [] });
    // Its badge sits at its top right, inside its shape's room.
    const badges = !marked ? [] : badgesAt(marks, x + w - inset - (BADGE.right + room.r) * t, y + inset + (BADGE.top + room.t) * t, t);
    return { ...base, scale, outline, edged, border, decoration: shape, label: { x: box.left, y: box.top, w: box.right - box.left, h: box.bottom - box.top }, lines: placed.lines, icons: placed.icons, badges };
  }

  // Nested and Voronoi (LA-EXP-DR62, LA-EXP-DR64): its border grows with its text; its shape is a mark before its kind and ID line.
  const scale = Math.max(0.5, t);
  const border = BORDER * scale;
  const icons: Place['icons'] = [...(file ? [] : [{ draw: 'shape' as const, name: shape }]), ...(mark ? [{ draw: 'mark' as const, name: mark }] : [])];
  if (source.view === 'nested') {
    const n = source.node;
    const box = { left: x + border + LABEL_PAD * t, right: x + w - border - LABEL_PAD * t, top: y + border + LABEL_PAD_BLOCK * t, bottom: n.header > 0 ? y + n.header - border - LABEL_PAD_BLOCK * t : y + h - border - LABEL_PAD_BLOCK * t };
    const placed = placeLines({ lines: n.lines, box, centered: n.centered, top: n.header > 0, t, icons });
    const outline = outlineOf('box', { x, y, w, h }, scale);
    const badges = marked ? badgesAt(marks, x + w - border - BADGE.right * t, y + border + BADGE.top * t, t) : [];
    return { ...base, scale, outline, edged: false, border, decoration: null, label: { x: box.left, y: box.top, w: box.right - box.left, h: box.bottom - box.top }, lines: placed.lines, icons: placed.icons, badges };
  }
  const n = (source as Extract<PlateSource, { view: 'voronoi' }>).node;
  const box = { left: n.label.x + LABEL_PAD * t, right: n.label.x + n.label.w - LABEL_PAD * t, top: n.label.y + CELL_PAD_BLOCK * t, bottom: n.label.y + n.label.h - CELL_PAD_BLOCK * t };
  const placed = placeLines({ lines: n.lines, box, centered: true, top: false, t, icons });
  const badges = marked ? badgesAt(marks, n.label.x + n.label.w - BADGE.right * t, n.label.y + BADGE.top * t, t) : [];
  return {
    ...base, scale, outline: { kind: 'polygon', points: n.polygon.map(([px, py]) => [px, py]) }, edged: true, border, decoration: null,
    label: { ...n.label }, lines: placed.lines, icons: placed.icons, badges,
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
