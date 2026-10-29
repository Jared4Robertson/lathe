import type { Row, SpecIndex, SpecRecord } from '../specs/data';
import { textOf, byIdOrder, partsOf } from '../specs/data';
import { focusStrength, type FadeLook } from '../graph/fade';

// The ERD stage's map, as plain data (no React): one entity-relationship diagram of a whole product,
// laid out once per product and data change (layout.ts), that every focus navigates (LA-V94-R08).
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

/** A line end: exactly one (two bars), many (a crow's foot), none (a plain end) or an arrowhead (the aggregate a reference points at). */
export type ErdEnd = 'one' | 'many' | 'none' | 'arrow';
/** What a box is: a domain's region, an aggregate (a boundary around its entities) or an entity. */
export type ErdKind = 'domain' | 'aggregate' | 'entity';

/** What a line stands for: a stored `has_one` or `has_many` link, or a field typed by another aggregate (`references`). */
export type ErdRelation = 'has_one' | 'has_many' | 'references';

/** The ends each line draws, at its source and its target. */
export const RELATION_ENDS: Record<ErdRelation, [ErdEnd, ErdEnd]> = {
  has_one: ['one', 'one'],
  has_many: ['one', 'many'],
  references: ['none', 'arrow'],
};

/** The words of a line that stands for no stored relation, read from the line's source. */
export const LINE_WORDS: Partial<Record<ErdRelation, string>> = {
  references: 'references by ID',
};

export interface ErdField { field: string; kind: string }

export interface ErdBox {
  id: string;
  kind: ErdKind;
  title: string;
  /** An entity that is its aggregate's root. */
  root: boolean;
  /** An entity's fields with their types (empty for a domain and an aggregate). */
  fields: ErdField[];
  /** The box it sits in: an entity's aggregate, an aggregate's domain; none for a domain. */
  parent?: string;
  /** A domain with no aggregates, or an aggregate with no entities: a closed box that says so. */
  empty: boolean;
}

export interface ErdLine {
  id: string;
  source: string;
  target: string;
  relation: ErdRelation;
  sourceEnd: ErdEnd;
  targetEnd: ErdEnd;
  dashed: boolean;
  /** The fields a reference stands for ("Loan.Member"), for its tooltip and its hover label. */
  via: string[];
}

/** A product's whole ERD: every domain's region with its aggregates and entities, and every line between them. */
export interface ErdMap {
  product: string;
  boxes: ErdBox[];
  lines: ErdLine[];
}

const isRootEntity = (r: SpecRecord) => textOf(r.row, 'role') === 'root';
const childrenOfKind = (index: SpecIndex, id: string, kind: string) => (index.children.get(id) ?? []).filter((r) => r.kind === kind).sort(byIdOrder);
const titleOf = (index: SpecIndex, id: string | null) => (id ? index.byId.get(id)?.title ?? id : '');
const targets = (index: SpecIndex, id: string, relation: string) =>
  (index.outgoing.get(id) ?? []).filter((l) => l.relation === relation).map((l) => index.byId.get(l.target)).filter((r): r is SpecRecord => !!r).sort(byIdOrder);

/** An aggregate's entities: the root first, then the children, in ID order. */
export function entitiesOf(index: SpecIndex, aggregate: string): SpecRecord[] {
  return [...childrenOfKind(index, aggregate, 'entity')].sort((a, b) => Number(isRootEntity(b)) - Number(isRootEntity(a)) || byIdOrder(a, b));
}

/** A field's type in words: its basic type, its value object's title, or "→ Aggregate" for a reference. */
export function fieldType(index: SpecIndex, field: Row): string {
  const vo = textOf(field, 'type_value_object_id');
  if (vo) return titleOf(index, vo);
  const aggregate = textOf(field, 'type_aggregate_id');
  if (aggregate) return `→ ${titleOf(index, aggregate)}`;
  return textOf(field, 'type');
}

const fieldsOf = (index: SpecIndex, id: string): ErdField[] =>
  partsOf(index, id, 'entity_field').map((f) => ({ field: textOf(f, 'name'), kind: fieldType(index, f) }));

const maps = new WeakMap<SpecIndex, Map<string, ErdMap>>();

/** A product's map: built once per index (a data change makes a new index), then read. */
export function erdMap(index: SpecIndex, productId: string): ErdMap {
  let known = maps.get(index);
  if (!known) { known = new Map(); maps.set(index, known); }
  const cached = known.get(productId);
  if (cached) return cached;
  const map = buildMap(index, productId);
  known.set(productId, map);
  return map;
}

function buildMap(index: SpecIndex, productId: string): ErdMap {
  const boxes = new Map<string, ErdBox>();
  const lines = new Map<string, ErdLine>();
  const domains = index.workspace.records.filter((r) => r.kind === 'domain' && r.product === productId).sort(byIdOrder);
  for (const d of domains) {
    const aggregates = childrenOfKind(index, d.id, 'aggregate');
    boxes.set(d.id, { id: d.id, kind: 'domain', title: d.title, root: false, fields: [], empty: aggregates.length === 0 });
    for (const a of aggregates) {
      const entities = entitiesOf(index, a.id);
      boxes.set(a.id, { id: a.id, kind: 'aggregate', title: a.title, root: false, fields: [], parent: d.id, empty: entities.length === 0 });
      for (const e of entities) boxes.set(e.id, { id: e.id, kind: 'entity', title: e.title, root: isRootEntity(e), fields: fieldsOf(index, e.id), parent: a.id, empty: false });
    }
  }
  const line = (source: string, relation: ErdRelation, target: string, via: string[] = []) => {
    if (source === target || !boxes.has(source) || !boxes.has(target)) return;
    const id = `${source}|${relation}|${target}`;
    const known = lines.get(id);
    if (known) { known.via.push(...via); return; }
    const [sourceEnd, targetEnd] = RELATION_ENDS[relation];
    lines.set(id, { id, source, target, relation, sourceEnd, targetEnd, dashed: relation === 'references', via: [...via] });
  };
  // Where a reference to an aggregate ends: at its root entity, or at its closed box when it has none.
  const rootOf = new Map<string, string>();
  for (const b of boxes.values()) if (b.kind === 'entity' && b.root && b.parent) rootOf.set(b.parent, b.id);
  const entities = [...boxes.values()].filter((b) => b.kind === 'entity');
  for (const e of entities) for (const relation of ['has_one', 'has_many'] as const) for (const t of targets(index, e.id, relation)) line(e.id, relation, t.id);
  for (const e of entities) {
    for (const f of partsOf(index, e.id, 'entity_field')) {
      const target = textOf(f, 'type_aggregate_id');
      if (!target || target === e.parent || !boxes.has(target)) continue;
      line(e.id, 'references', rootOf.get(target) ?? target, [`${e.title}.${textOf(f, 'name')}`]);
    }
  }
  return { product: productId, boxes: [...boxes.values()], lines: [...lines.values()] };
}

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
export function erdFocus(index: SpecIndex, focus: string): ErdFocus | null {
  const slash = focus.indexOf('/');
  if (slash > 0) return erdFocus(index, focus.slice(0, slash));
  const record = index.byId.get(focus);
  if (!record?.product) return null;
  const product = record.product;
  if (record.kind === 'product') return { product, scope: product, pick: null };
  if (record.kind === 'domain' || record.kind === 'aggregate') return { product, scope: record.id, pick: record.id };
  if (record.kind === 'entity' && record.parent) return { product, scope: record.parent, pick: record.id };
  let pick: string | null = null;
  for (let at: SpecRecord | undefined = record; at; at = at.parent ? index.byId.get(at.parent) : undefined) {
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
 * How strongly each box is drawn for a focus, 0 to 1: the graph's focus fade (graph/fade.ts) with
 * the scope as its focus: the scope and what lies in it at full strength, the regions around it
 * as a trail, the rest faded. The whole product is the scope of a product's focus: nothing fades.
 */
export function erdStrength(map: ErdMap, scope: string, look: FadeLook): (id: string) => number {
  if (scope === map.product) return () => 1;
  const nodes = new Map(map.boxes.map((b) => [b.id, { parent: b.parent ?? null }]));
  return focusStrength({ view: 'nested', nodes }, scope, look);
}

// ---------- Geometry ----------

export type Point = { x: number; y: number };
export interface Rect { x: number; y: number; width: number; height: number }

/** An entity's width, and a closed aggregate box's. */
export const BOX_WIDTH = 210;
/** The parts of a box's height, in CSS pixels at the default text size (styles.css .erd-box): its padding and border, a title line, the kind line, a row, and the rows' rule. */
const FRAME = 22;
const TITLE_LINE = 16;
const KIND_LINE = 14;
export const ROW = 20;
const ROWS_RULE = 11;
/** The room a boundary keeps around its entities: its head (one title line and the kind line) on top, and a gap on the other sides (styles.css .erd-boundary). */
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

/** The drawing of one end: two bars for one, a crow's foot for many, an arrowhead. `toward` is the line's other end. */
export function endPath(at: Point, toward: Point, end: ErdEnd): string {
  const len = Math.hypot(toward.x - at.x, toward.y - at.y) || 1;
  const u = { x: (toward.x - at.x) / len, y: (toward.y - at.y) / len };
  const n = { x: -u.y, y: u.x };
  const along = (d: number) => ({ x: at.x + u.x * d, y: at.y + u.y * d });
  const f = (p: Point) => `${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`;
  const bar = (d: number, w = 6) => {
    const q = along(d);
    return `M ${f({ x: q.x + n.x * w, y: q.y + n.y * w })} L ${f({ x: q.x - n.x * w, y: q.y - n.y * w })}`;
  };
  if (end === 'none') return '';
  if (end === 'one') return `${bar(7)} ${bar(12)}`;
  if (end === 'arrow') {
    const back = along(9);
    return `M ${f({ x: back.x + n.x * 5, y: back.y + n.y * 5 })} L ${f(at)} L ${f({ x: back.x - n.x * 5, y: back.y - n.y * 5 })}`;
  }
  const base = along(14);
  const prong = (side: number) => `M ${f(base)} L ${f({ x: at.x + n.x * 7 * side, y: at.y + n.y * 7 * side })}`;
  return `${prong(1)} M ${f(base)} L ${f(at)} ${prong(-1)} ${bar(17)}`;
}

/**
 * A line between two boxes: straight from box edge to box edge, moved sideways by `offset` so that
 * two lines between the same boxes sit apart, with the drawing of each end.
 */
export function lineGeometry(source: Rect, target: Rect, ends: [ErdEnd, ErdEnd], offset = 0) {
  const sc = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const tc = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const len = Math.hypot(tc.x - sc.x, tc.y - sc.y) || 1;
  const n = { x: -(tc.y - sc.y) / len, y: (tc.x - sc.x) / len };
  const s = { x: sc.x + n.x * offset, y: sc.y + n.y * offset };
  const t = { x: tc.x + n.x * offset, y: tc.y + n.y * offset };
  const a = exitPoint(source, t.x, t.y);
  const b = exitPoint(target, s.x, s.y);
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
