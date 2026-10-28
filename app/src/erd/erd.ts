import type { Row, SpecIndex, SpecRecord } from '../specs/data';
import { textOf, byIdOrder, partsOf } from '../specs/data';

// The ERD view's diagrams, as plain data (no React): the entity-relationship diagram of a domain or
// of an aggregate, entities and their relationships only.
//
// - A domain's ERD: each of its aggregates as a boundary around its entities (the root marked), each
//   entity with its fields and their types; a has one or has many line between entities, with crow's
//   feet; and a dashed reference-by-ID line from an entity holding a field typed by another aggregate
//   to that aggregate's root. Another domain's aggregate is a closed box, faded, labeled with its domain.
// - An aggregate's ERD: its boundary, entities and lines, with the aggregates it references, and those
//   that reference it, faded around it as closed boxes.
// - An entity's ERD is its aggregate's, with the entity highlighted.

export type ErdLevel = 'product' | 'domain' | 'aggregate';
/** A line end: exactly one (two bars), many (a crow's foot), none (a plain end) or an arrowhead (the aggregate a reference points at). */
export type ErdEnd = 'one' | 'many' | 'none' | 'arrow';
/** Who owns a box: the current domain or another one (gray, labeled with its domain). */
export type ErdTone = 'current' | 'other';
/** What a box is: an aggregate (a boundary around its entities, or a closed box) or an entity. */
export type ErdKind = 'aggregate' | 'entity';

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
  /** The domain of a box from another domain ("Accounts"); null for the current domain's. */
  owner: string | null;
  tone: ErdTone;
  /** An entity that is its aggregate's root. */
  root: boolean;
  /** An entity's fields with their types (empty for an aggregate). */
  fields: ErdField[];
  /** An entity's aggregate, drawn as the boundary around it. */
  parent?: string;
  /** An aggregate drawn as a boundary around its entities (a closed box otherwise). */
  boundary: boolean;
  /** The record the page is about, highlighted. */
  highlight: boolean;
  /** Faded context: drawn out of focus and out of the keyboard order. */
  context: boolean;
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
  /** To or from a context box: drawn faded. */
  context: boolean;
}

export interface Erd {
  level: ErdLevel;
  /** The domain or aggregate the diagram draws. */
  scope: string;
  /** The domain it belongs to. */
  domain: string;
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

interface Reference { entity: SpecRecord; target: SpecRecord; via: string[] }

/** The references by ID an aggregate's entities hold to other aggregates: one per entity and aggregate, with its fields ("Loan.Member"). */
function referencesFrom(index: SpecIndex, aggregate: string): Reference[] {
  const found = new Map<string, Reference>();
  for (const entity of entitiesOf(index, aggregate)) {
    for (const f of partsOf(index, entity.id, 'entity_field')) {
      const id = textOf(f, 'type_aggregate_id');
      const target = id ? index.byId.get(id) : undefined;
      if (!target || target.id === aggregate) continue;
      const key = `${entity.id}|${id}`;
      const entry = found.get(key) ?? { entity, target, via: [] };
      entry.via.push(`${entity.title}.${textOf(f, 'name')}`);
      found.set(key, entry);
    }
  }
  return [...found.values()].sort((a, b) => byIdOrder(a.entity, b.entity) || byIdOrder(a.target, b.target));
}

/** The aggregates whose entities hold a reference to an aggregate, in ID order. */
function referencingAggregates(index: SpecIndex, aggregate: string): SpecRecord[] {
  const found = new Map<string, SpecRecord>();
  for (const r of index.workspace.records) {
    if (r.kind !== 'entity' || !r.parent || r.parent === aggregate) continue;
    if (!partsOf(index, r.id, 'entity_field').some((f) => textOf(f, 'type_aggregate_id') === aggregate)) continue;
    const owner = index.byId.get(r.parent);
    if (owner) found.set(owner.id, owner);
  }
  return [...found.values()].sort(byIdOrder);
}

/**
 * What the ERD stage draws for a focus (LA-PAT-APP-UX-R16: every stage works on every focus): a
 * domain's ERD; an aggregate's (an entity's highlighted in it); for a group, its owner's. For any
 * other record, its domain's ERD with the nearest entity or aggregate above it highlighted, or for a
 * Shared record (one in no domain) and a product, the product's ERD. Null only for an unknown focus.
 */
export function modelScope(index: SpecIndex, focus: string): { level: ErdLevel; scope: string; highlight: string | null } | null {
  const slash = focus.indexOf('/');
  if (slash > 0) return modelScope(index, focus.slice(0, slash));
  const record = index.byId.get(focus);
  if (!record) return null;
  if (record.kind === 'domain') return { level: 'domain', scope: record.id, highlight: null };
  if (record.kind === 'aggregate') return { level: 'aggregate', scope: record.id, highlight: null };
  if (record.kind === 'entity' && record.parent) return { level: 'aggregate', scope: record.parent, highlight: record.id };
  if (record.kind === 'product') return { level: 'product', scope: record.id, highlight: null };
  let highlight: string | null = null;
  for (let at: SpecRecord | undefined = record; at; at = at.parent ? index.byId.get(at.parent) : undefined) {
    if (at.kind === 'entity' || at.kind === 'aggregate') { highlight = at.id; break; }
  }
  if (record.domain) return { level: 'domain', scope: record.domain, highlight };
  if (record.product) return { level: 'product', scope: record.product, highlight };
  return null;
}

/** The diagram for a focus, or null for an unknown one. */
export function erdFor(index: SpecIndex, focus: string): Erd | null {
  const scope = modelScope(index, focus);
  if (!scope) return null;
  if (scope.level === 'product') return productErd(index, scope.scope, scope.highlight);
  return scope.level === 'domain' ? domainErd(index, scope.scope, scope.highlight) : aggregateErd(index, scope.scope, scope.highlight);
}

/** What an ERD with nothing to draw says, by its level. */
export const ERD_EMPTY: Record<ErdLevel, string> = {
  product: 'This product has no aggregates yet.',
  domain: 'This domain has no aggregates yet.',
  aggregate: 'This aggregate has no entities yet.',
};

/** Whether an ERD has nothing to draw: no aggregate for a product or a domain, no entity for an aggregate. */
export const erdEmpty = (erd: Erd) => (erd.level === 'aggregate' ? !erd.boxes.some((b) => b.kind === 'entity') : erd.boxes.length === 0);

/** A product's ERD, for a Shared record: every domain's aggregates as boundaries, none drawn as another domain's. */
export function productErd(index: SpecIndex, productId: string, highlight: string | null = null): Erd {
  const b = new Builder(index, '', highlight, true);
  const aggregates = index.workspace.records.filter((r) => r.kind === 'aggregate' && r.product === productId).sort(byIdOrder);
  for (const a of aggregates) b.aggregate(a, true);
  b.relationships();
  for (const a of aggregates) b.references(a.id, false);
  return b.done('product', productId);
}

/** Builds a diagram's boxes and lines, each once. */
class Builder {
  boxes = new Map<string, ErdBox>();
  lines = new Map<string, ErdLine>();
  constructor(private index: SpecIndex, private domainId: string, private highlight: string | null, private wholeProduct = false) {}

  /** An aggregate's box: a boundary around its entities, drawn with them, or a closed box (faded context). */
  aggregate(record: SpecRecord, boundary: boolean, context = false) {
    if (this.boxes.has(record.id)) return;
    const other = !this.wholeProduct && !!record.domain && record.domain !== this.domainId;
    this.boxes.set(record.id, {
      id: record.id, kind: 'aggregate', title: record.title, owner: other ? titleOf(this.index, record.domain) : null, tone: other ? 'other' : 'current',
      root: false, fields: [], boundary, highlight: record.id === this.highlight, context: context || other,
    });
    if (!boundary) return;
    for (const e of entitiesOf(this.index, record.id)) {
      this.boxes.set(e.id, {
        id: e.id, kind: 'entity', title: e.title, owner: null, tone: 'current', root: isRootEntity(e), fields: fieldsOf(this.index, e.id),
        parent: record.id, boundary: false, highlight: e.id === this.highlight, context: false,
      });
    }
  }

  line(source: string, relation: ErdRelation, target: string, via: string[] = []) {
    if (source === target || !this.boxes.has(source) || !this.boxes.has(target)) return;
    const id = `${source}|${relation}|${target}`;
    const known = this.lines.get(id);
    if (known) { known.via.push(...via); return; }
    const [sourceEnd, targetEnd] = RELATION_ENDS[relation];
    const context = this.boxes.get(source)!.context || this.boxes.get(target)!.context;
    this.lines.set(id, { id, source, target, relation, sourceEnd, targetEnd, dashed: relation === 'references', via: [...via], context });
  }

  /** Where a reference to an aggregate ends: at its root entity when its boundary is drawn, else at its box. */
  referenceEnd(aggregate: string): string {
    const root = [...this.boxes.values()].find((b) => b.parent === aggregate && b.root);
    return root?.id ?? aggregate;
  }

  /** The has one and has many lines between the entities drawn. */
  relationships() {
    for (const box of [...this.boxes.values()]) {
      if (box.kind !== 'entity') continue;
      for (const relation of ['has_one', 'has_many'] as const) for (const t of targets(this.index, box.id, relation)) this.line(box.id, relation, t.id);
    }
  }

  /** The references by ID an aggregate's entities hold, each from its entity to the aggregate it names. */
  references(aggregate: string, context: boolean) {
    for (const ref of referencesFrom(this.index, aggregate)) {
      this.aggregate(ref.target, false, context);
      this.line(ref.entity.id, 'references', this.referenceEnd(ref.target.id), ref.via);
    }
  }

  done(level: ErdLevel, scope: string): Erd {
    return { level, scope, domain: this.domainId, boxes: [...this.boxes.values()], lines: [...this.lines.values()] };
  }
}

/** A domain's ERD: its aggregates as boundaries around their entities, with their relationships and references. */
export function domainErd(index: SpecIndex, domainId: string, highlight: string | null = null): Erd {
  const b = new Builder(index, domainId, highlight);
  const aggregates = childrenOfKind(index, domainId, 'aggregate');
  for (const a of aggregates) b.aggregate(a, true);
  b.relationships();
  for (const a of aggregates) b.references(a.id, false);
  return b.done('domain', domainId);
}

/** An aggregate's ERD: its entities and relationships, with the aggregates it references, or that reference it, faded around it. */
export function aggregateErd(index: SpecIndex, aggregateId: string, highlight: string | null = null): Erd {
  const aggregate = index.byId.get(aggregateId);
  const b = new Builder(index, aggregate?.domain ?? '', highlight);
  if (!aggregate) return b.done('aggregate', aggregateId);
  b.aggregate(aggregate, true);
  b.relationships();
  b.references(aggregateId, true);
  for (const other of referencingAggregates(index, aggregateId)) {
    b.aggregate(other, false, true);
    const via = referencesFrom(index, other.id).filter((r) => r.target.id === aggregateId).flatMap((r) => r.via);
    b.line(other.id, 'references', b.referenceEnd(aggregateId), via);
  }
  return b.done('aggregate', aggregateId);
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

/** A closed aggregate box's size (its title on one line and its kind line), or an entity's (its title on up to two lines and its fields). A boundary's size is its entities' layout's. */
export function boxSize(box: ErdBox): { width: number; height: number } {
  if (box.kind === 'aggregate') return { width: BOX_WIDTH, height: FRAME + TITLE_LINE + KIND_LINE };
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
