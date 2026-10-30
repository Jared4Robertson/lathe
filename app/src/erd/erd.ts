import type { ErdBox, ErdEnd, ErdKind, ErdLine, ErdMap, ErdRelation } from '../../../lathe/src/exploring/erd/read-model';
import { type RecordIndex, type RecordSummary } from '../exploring/record-summaries/record-index';
import { keptFade, type Fade, type FadeLook } from '../graph/fade';
import { useRead, type Read } from '../record/read';

// The ERD stage's map: one entity-relationship diagram of a whole product, as the ERD read gives it (LA-EXP-RM04,
// get-erd), laid out once for what it reads (layout.ts), that every focus navigates (LA-V94-R08).
//
// - Each domain is a region; its aggregates are areas inside it, each a boundary around its entities
//   (the root marked), each entity with its fields and their types. A domain with no aggregates, and
//   an aggregate with no entities, is a closed box that says so.
// - A has one or has many line joins two entities, with crow's feet; a dashed reference-by-ID line
//   runs from an entity holding a field typed by another aggregate to that aggregate's root, across
//   regions when the aggregate is another domain's.
// - A focus picks a scope (a domain, an aggregate or the product) drawn at full strength, the rest
//   faded (the graph's focus fade), and a box to pick out; the camera frames that box, or the scope.
//   Nothing on the map moves or changes size with the focus.

export type { ErdBox, ErdEnd, ErdKind, ErdLine, ErdMap, ErdRelation };

/** The ends each line draws, at its source and its target: as the ERD read draws them, for the key's sample lines. */
export const RELATION_ENDS: Record<ErdRelation, [ErdEnd, ErdEnd]> = {
  has_one: ['one', 'one'],
  has_many: ['one', 'many'],
  references: ['none', 'arrow'],
};

/** The words of a line that stands for no stored relation, read from the line's source. */
export const LINE_WORDS: Partial<Record<ErdRelation, string>> = {
  references: 'references by ID',
};

/** A product's map as the ERD read gives it (get-erd): read again whenever the data is (`version`). */
export const useErd = (product: string | null, version: unknown): Read<ErdMap> =>
  useRead<ErdMap>('/api/erd/get-erd', product ? { product_id: product } : null, version);

/**
 * What a focus does on its product's map (LA-PAT-APP-UX-R17: every stage works on every focus).
 * `scope` is drawn at full strength and the rest faded: a domain, an aggregate (an entity's too),
 * else the record's domain, or for a Shared record (one in no domain) and a product the whole
 * product. `pick` is picked out: the record itself when it is a box (a domain, an aggregate, an
 * entity), else its nearest entity or aggregate above it in the tree (a table frames the entity it
 * stores); none otherwise. A group counts as its owner. The camera frames `pick`, or the scope.
 */
export interface ErdFocus { product: string; scope: string; pick: string | null }

/** A focus on its product's map, or null for an unknown focus or one in no product. */
export function erdFocus(index: RecordIndex, focus: string): ErdFocus | null {
  const slash = focus.indexOf('/');
  if (slash > 0) return erdFocus(index, focus.slice(0, slash));
  const record = index.byId.get(focus);
  if (!record?.product) return null;
  const product = record.product;
  if (record.kind === 'product') return { product, scope: product, pick: null };
  if (record.kind === 'domain' || record.kind === 'aggregate') return { product, scope: record.id, pick: record.id };
  if (record.kind === 'entity' && record.parent) return { product, scope: record.parent, pick: record.id };
  let pick: string | null = null;
  for (let at: RecordSummary | undefined = record; at; at = at.parent ? index.byId.get(at.parent) : undefined) {
    if (at.kind === 'entity' || at.kind === 'aggregate') { pick = at.id; break; }
  }
  return { product, scope: record.domain ?? product, pick };
}

/** What the map says when its product has nothing to draw. */
export const ERD_EMPTY = 'This product has no domains yet.';

const parentCache = new WeakMap<ErdMap, Map<string, string | undefined>>();
/** Each box's parent, by its ID. */
function parentsOf(map: ErdMap): Map<string, string | undefined> {
  let known = parentCache.get(map);
  if (!known) { known = new Map(map.boxes.map((b) => [b.id, b.parent])); parentCache.set(map, known); }
  return known;
}

/** Whether a box lies in a scope: the scope itself or under it. Every box lies in its product. */
export function inScope(map: ErdMap, scope: string, id: string): boolean {
  if (scope === map.product) return true;
  const parents = parentsOf(map);
  for (let at: string | undefined = id; at; at = parents.get(at)) if (at === scope) return true;
  return false;
}

/** The boxes in a scope, and the lines with an end in it. */
export function scopeContents(map: ErdMap, scope: string): { boxes: ErdBox[]; lines: ErdLine[] } {
  const boxes = map.boxes.filter((b) => inScope(map, scope, b.id));
  const ids = new Set(boxes.map((b) => b.id));
  return { boxes, lines: map.lines.filter((l) => ids.has(l.source) || ids.has(l.target)) };
}

/**
 * How strongly each box is drawn for a focus, by its place (a box's ID), 0 to 1: the shared fade of
 * every one-map stage (graph/fade.ts `keptFade`, LA-PAT-APP-UX-R19), keeping the scope and what lies
 * in it at full strength and fading the rest back. A product's focus keeps the whole map.
 */
export function erdStrength(map: ErdMap, scope: string, look: Pick<FadeLook, 'focusFade'>): Fade {
  return keptFade((id) => inScope(map, scope, id), look);
}

// ---------- Geometry ----------

export type Point = { x: number; y: number };
export interface Rect { x: number; y: number; width: number; height: number }

/** An entity's width, and a closed aggregate box's. */
export const BOX_WIDTH = 210;
/** The parts of a box's height, in map units (CSS pixels at zoom 1, as paint.ts draws a box): its padding and border, a title line, the kind line, a row, and the rows' rule. */
const FRAME = 22;
const TITLE_LINE = 16;
const KIND_LINE = 14;
export const ROW = 20;
const ROWS_RULE = 11;
/** The room a boundary keeps around its entities: its head (one title line and the kind line) on top, and a gap on the other sides. */
export const BOUNDARY_PAD = { top: FRAME / 2 + TITLE_LINE + KIND_LINE + 12, side: 14, bottom: 14 };
/** About how many characters of a title fit on a line, by box width (the display face's bold at 0.8125rem). */
const charsPerLine = (width: number) => Math.floor((width - 20) / 7.6);

/** How many lines a title takes, at most two (a longer one ends with an ellipsis, its whole text in the box's tooltip). */
export function titleLines(title: string, width: number, badge = false): number {
  const per = charsPerLine(width) - (badge ? 6 : 0);
  let lines = 1;
  let used = 0;
  for (const word of title.split(/\s+/)) {
    const need = used === 0 ? word.length : used + 1 + word.length;
    if (need <= per || used === 0) used = need;
    else { lines++; used = word.length; }
  }
  return Math.min(2, lines);
}

/** A closed box's size, a domain's or an aggregate's (its title on one line and its kind line), or an entity's (its title on up to two lines and its fields). A boundary's size is its entities' layout's. */
export function boxSize(box: ErdBox): { width: number; height: number } {
  if (box.kind !== 'entity') return { width: BOX_WIDTH, height: FRAME + TITLE_LINE + KIND_LINE };
  const head = FRAME + TITLE_LINE * titleLines(box.title, BOX_WIDTH, box.root);
  return { width: BOX_WIDTH, height: box.fields.length === 0 ? head : head + ROWS_RULE + ROW * box.fields.length };
}

/** Where the line from a box's center toward (tx, ty) leaves the box. */
function exitPoint(r: Rect, tx: number, ty: number): Point {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = 1 / Math.max(Math.abs(dx) / (r.width / 2), Math.abs(dy) / (r.height / 2));
  return { x: cx + dx * scale, y: cy + dy * scale };
}

/** The strokes of one end, each a run of points: two bars for one, a crow's foot (three prongs and a bar) for many, an arrowhead. `toward` is the line's other end. */
export function endStrokes(at: Point, toward: Point, end: ErdEnd): Point[][] {
  const len = Math.hypot(toward.x - at.x, toward.y - at.y) || 1;
  const u = { x: (toward.x - at.x) / len, y: (toward.y - at.y) / len };
  const n = { x: -u.y, y: u.x };
  const along = (d: number) => ({ x: at.x + u.x * d, y: at.y + u.y * d });
  const bar = (d: number, w = 6) => {
    const q = along(d);
    return [{ x: q.x + n.x * w, y: q.y + n.y * w }, { x: q.x - n.x * w, y: q.y - n.y * w }];
  };
  if (end === 'none') return [];
  if (end === 'one') return [bar(7), bar(12)];
  if (end === 'arrow') {
    const back = along(9);
    return [[{ x: back.x + n.x * 5, y: back.y + n.y * 5 }, at, { x: back.x - n.x * 5, y: back.y - n.y * 5 }]];
  }
  const base = along(14);
  const prong = (side: number) => [base, { x: at.x + n.x * 7 * side, y: at.y + n.y * 7 * side }];
  return [prong(1), [base, at], prong(-1), bar(17)];
}

/** The drawing of one end as an SVG path (the key's samples): its strokes, each a move and lines. */
export function endPath(at: Point, toward: Point, end: ErdEnd): string {
  const f = (p: Point) => `${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`;
  return endStrokes(at, toward, end).map((run) => run.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(p)}`).join(' ')).join(' ');
}

/** Where a line between two boxes meets them: straight from box edge to box edge, moved sideways by `offset` so that two lines between the same boxes sit apart. */
export function lineEnds(source: Rect, target: Rect, offset = 0): { from: Point; to: Point } {
  const sc = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const tc = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const len = Math.hypot(tc.x - sc.x, tc.y - sc.y) || 1;
  const n = { x: -(tc.y - sc.y) / len, y: (tc.x - sc.x) / len };
  const s = { x: sc.x + n.x * offset, y: sc.y + n.y * offset };
  const t = { x: tc.x + n.x * offset, y: tc.y + n.y * offset };
  return { from: exitPoint(source, t.x, t.y), to: exitPoint(target, s.x, s.y) };
}

/** A line between two boxes as SVG paths (the key's samples): its ends (lineEnds), its stroke and the drawing of each end. */
export function lineGeometry(source: Rect, target: Rect, ends: [ErdEnd, ErdEnd], offset = 0) {
  const { from: a, to: b } = lineEnds(source, target, offset);
  return { from: a, to: b, line: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, sourceEnd: endPath(a, b, ends[0]), targetEnd: endPath(b, a, ends[1]) };
}

/** The sideways offset of each line, so lines between the same two boxes fan out instead of overlapping. */
export function lineOffsets(lines: readonly ErdLine[], gap = 14): Map<string, number> {
  const pairs = new Map<string, ErdLine[]>();
  for (const l of lines) {
    const key = [l.source, l.target].sort().join('|');
    pairs.set(key, [...(pairs.get(key) ?? []), l]);
  }
  const out = new Map<string, number>();
  for (const group of pairs.values()) {
    group.forEach((l, i) => {
      // Measured from the pair in sorted order, so lines pointing either way fan out on one axis.
      const flipped = l.source > l.target ? -1 : 1;
      out.set(l.id, (i - (group.length - 1) / 2) * gap * flipped);
    });
  }
  return out;
}
