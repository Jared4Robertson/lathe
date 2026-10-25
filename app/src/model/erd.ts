import type { SpecIndex, SpecLink, SpecRecord } from '../specs/data';
import { byIdOrder } from '../specs/data';

// The Model view's ERDs, as plain data (no React): what boxes and lines a domain's or an
// aggregate's entity-relationship diagram draws, drawn the way client_sandbox's domain models are.
//
// - A domain's ERD is drawn at aggregate level: one box per aggregate (its title, its root entity
//   and how many entities it has), and one line per aggregate pair and direction that a `refers_to`
//   link between their entities joins, many to one. An aggregate whose entities refer to no other
//   aggregate falls back to its own `relates_to` links, drawn dashed.
// - An aggregate's ERD draws its entities (title, root mark, each field's name and kind of value),
//   and exactly one line per `has_one`, `has_many` or `refers_to` link its entities hold, with the
//   crow's-foot ends of the link's cardinality. An entity page draws its aggregate's ERD with the
//   entity highlighted.
// - Boxes owned by the current domain are blue; boxes from another domain are gray, labeled with
//   their owner in parentheses. A box from another aggregate of the same domain stays blue and is
//   labeled with its aggregate, as Client does.

export type ErdLevel = 'domain' | 'aggregate';
/** A line end: exactly one (two bars) or many (a crow's foot). */
export type ErdEnd = 'one' | 'many';
/** Who owns a box: the current domain (blue) or another one (gray). */
export type ErdTone = 'current' | 'other';

export const ENTITY_RELATIONS = ['has_one', 'has_many', 'refers_to'] as const;
export type EntityRelation = (typeof ENTITY_RELATIONS)[number];

/** The ends each relationship draws, at its source and its target. */
export const RELATION_ENDS: Record<EntityRelation | 'relates_to', [ErdEnd, ErdEnd]> = {
  has_one: ['one', 'one'],
  has_many: ['one', 'many'],
  refers_to: ['many', 'one'],
  relates_to: ['many', 'one'],
};

export const RELATION_LABELS: Record<EntityRelation | 'relates_to', string> = {
  has_one: 'has one',
  has_many: 'has many',
  refers_to: 'refers to',
  relates_to: 'relates to',
};

export interface ErdField { field: string; kind: string }

export interface ErdBox {
  id: string;
  /** 'aggregate' on a domain's ERD, 'entity' on an aggregate's. */
  kind: 'aggregate' | 'entity';
  title: string;
  /** The owner in parentheses for a box from elsewhere: "(Loan)" or "(Lending · Loan)"; null for the diagram's own boxes. */
  owner: string | null;
  tone: ErdTone;
  /** True for a box outside the diagram's own aggregate or domain. */
  foreign: boolean;
  /** An entity that is its aggregate's root. */
  root: boolean;
  /** An entity's fields (empty for an aggregate and a foreign entity). */
  fields: ErdField[];
  /** An aggregate's root entity's title, and how many entities it holds. */
  rootTitle?: string | null;
  entities?: number;
  /** The record the page is about, highlighted (an entity on its own page). */
  highlight: boolean;
}

export interface ErdLine {
  id: string;
  source: string;
  target: string;
  relation: EntityRelation | 'relates_to';
  sourceEnd: ErdEnd;
  targetEnd: ErdEnd;
  /** A fallback `relates_to` line between aggregates. */
  dashed: boolean;
  /** The links the line stands for: one on an aggregate's ERD; every entity reference between the pair on a domain's. */
  links: SpecLink[];
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

const isEntityRelation = (r: string): r is EntityRelation => (ENTITY_RELATIONS as readonly string[]).includes(r);

/** An aggregate's entities: the root first, then the children, in ID order. */
export function entitiesOf(index: SpecIndex, aggregate: string): SpecRecord[] {
  const entities = (index.children.get(aggregate) ?? []).filter((r) => r.kind === 'entity');
  const isRoot = (r: SpecRecord) => r.fields.role?.trim().toLowerCase() === 'root';
  return [...entities].sort((a, b) => Number(isRoot(b)) - Number(isRoot(a)) || byIdOrder(a, b));
}

const isRootEntity = (r: SpecRecord) => r.fields.role?.trim().toLowerCase() === 'root';

/** The aggregate an entity sits under, or null. */
function aggregateOf(index: SpecIndex, entity: SpecRecord): SpecRecord | null {
  const parent = entity.parent ? index.byId.get(entity.parent) : undefined;
  return parent?.kind === 'aggregate' ? parent : null;
}

const titleOf = (index: SpecIndex, id: string | null) => (id ? index.byId.get(id)?.title ?? id : '');

/** What the Model view draws for a page: a domain's ERD, an aggregate's, or an entity's aggregate's; null for any other page. */
export function modelScope(index: SpecIndex, focus: string): { level: ErdLevel; scope: string; highlight: string | null } | null {
  const record = index.byId.get(focus);
  if (!record) return null;
  if (record.kind === 'domain') return { level: 'domain', scope: record.id, highlight: null };
  if (record.kind === 'aggregate') return { level: 'aggregate', scope: record.id, highlight: null };
  if (record.kind === 'entity') {
    const aggregate = aggregateOf(index, record);
    return aggregate ? { level: 'aggregate', scope: aggregate.id, highlight: record.id } : null;
  }
  return null;
}

/** The ERD for a page, or null when the page has none. */
export function erdFor(index: SpecIndex, focus: string): Erd | null {
  const scope = modelScope(index, focus);
  if (!scope) return null;
  return scope.level === 'domain' ? domainErd(index, scope.scope) : aggregateErd(index, scope.scope, scope.highlight);
}

/** A domain's ERD at aggregate level. */
export function domainErd(index: SpecIndex, domainId: string): Erd {
  const aggregates = (index.children.get(domainId) ?? []).filter((r) => r.kind === 'aggregate');
  const boxes = new Map<string, ErdBox>();
  const aggregateBox = (a: SpecRecord): ErdBox => {
    const entities = entitiesOf(index, a.id);
    const root = entities.find(isRootEntity) ?? null;
    const foreign = a.domain !== domainId;
    return {
      id: a.id,
      kind: 'aggregate',
      title: a.title,
      owner: foreign ? `(${titleOf(index, a.domain)})` : null,
      tone: foreign ? 'other' : 'current',
      foreign,
      root: false,
      fields: [],
      rootTitle: root?.title ?? null,
      entities: entities.length,
      highlight: false,
    };
  };
  for (const a of aggregates) boxes.set(a.id, aggregateBox(a));

  const lines = new Map<string, ErdLine>();
  const referring = new Set<string>();
  for (const a of aggregates) {
    for (const e of entitiesOf(index, a.id)) {
      for (const l of index.outgoing.get(e.id) ?? []) {
        if (l.relation !== 'refers_to') continue;
        const target = index.byId.get(l.target);
        const other = target?.kind === 'entity' ? aggregateOf(index, target) : null;
        if (!other || other.id === a.id) continue;
        if (!boxes.has(other.id)) boxes.set(other.id, aggregateBox(other));
        referring.add(a.id);
        const id = `${a.id}|refers_to|${other.id}`;
        const line = lines.get(id);
        if (line) line.links.push(l);
        else lines.set(id, { id, source: a.id, target: other.id, relation: 'refers_to', sourceEnd: 'many', targetEnd: 'one', dashed: false, links: [l] });
      }
    }
  }
  // An aggregate whose entities refer to no other aggregate: its own relates_to links, dashed.
  for (const a of aggregates) {
    if (referring.has(a.id)) continue;
    for (const l of index.outgoing.get(a.id) ?? []) {
      if (l.relation !== 'relates_to') continue;
      const other = index.byId.get(l.target);
      if (other?.kind !== 'aggregate' || other.id === a.id) continue;
      if (!boxes.has(other.id)) boxes.set(other.id, aggregateBox(other));
      const id = `${a.id}|relates_to|${other.id}`;
      if (!lines.has(id)) lines.set(id, { id, source: a.id, target: other.id, relation: 'relates_to', sourceEnd: 'many', targetEnd: 'one', dashed: true, links: [l] });
    }
  }
  return { level: 'domain', scope: domainId, domain: domainId, boxes: [...boxes.values()], lines: [...lines.values()] };
}

/** An aggregate's ERD: its entities, and one line per entity relationship they hold. */
export function aggregateErd(index: SpecIndex, aggregateId: string, highlight: string | null = null): Erd {
  const aggregate = index.byId.get(aggregateId);
  const domainId = aggregate?.domain ?? '';
  const boxes = new Map<string, ErdBox>();
  const own = entitiesOf(index, aggregateId);
  for (const e of own) {
    boxes.set(e.id, {
      id: e.id,
      kind: 'entity',
      title: e.title,
      owner: null,
      tone: 'current',
      foreign: false,
      root: isRootEntity(e),
      fields: (e.entityFields ?? []).map((f) => ({ field: f.field, kind: f.kind })),
      highlight: e.id === highlight,
    });
  }
  const lines: ErdLine[] = [];
  for (const e of own) {
    for (const l of index.outgoing.get(e.id) ?? []) {
      if (!isEntityRelation(l.relation)) continue;
      const target = index.byId.get(l.target);
      if (target?.kind !== 'entity') continue;
      if (!boxes.has(target.id)) {
        const other = aggregateOf(index, target);
        const sameDomain = target.domain === domainId;
        const aggTitle = other?.title ?? '';
        boxes.set(target.id, {
          id: target.id,
          kind: 'entity',
          title: target.title,
          owner: sameDomain ? `(${aggTitle})` : `(${titleOf(index, target.domain)} · ${aggTitle})`,
          tone: sameDomain ? 'current' : 'other',
          foreign: true,
          root: isRootEntity(target),
          fields: [],
          highlight: false,
        });
      }
      const [sourceEnd, targetEnd] = RELATION_ENDS[l.relation];
      lines.push({ id: `${e.id}|${l.relation}|${target.id}`, source: e.id, target: target.id, relation: l.relation, sourceEnd, targetEnd, dashed: false, links: [l] });
    }
  }
  return { level: 'aggregate', scope: aggregateId, domain: domainId, boxes: [...boxes.values()], lines };
}

// ---------- Geometry ----------

export type Point = { x: number; y: number };
export interface Rect { x: number; y: number; width: number; height: number }

export const AGGREGATE_BOX = { width: 210, height: 78 };
export const ENTITY_WIDTH = 240;
export const ENTITY_HEAD = 46;
export const FIELD_ROW = 20;
export const FOREIGN_ENTITY_HEIGHT = 50;

/** A box's size: an aggregate's is fixed; an entity's grows with its fields. */
export function boxSize(box: ErdBox): { width: number; height: number } {
  if (box.kind === 'aggregate') return AGGREGATE_BOX;
  if (box.foreign) return { width: ENTITY_WIDTH, height: FOREIGN_ENTITY_HEIGHT };
  return { width: ENTITY_WIDTH, height: ENTITY_HEAD + FIELD_ROW * Math.max(1, box.fields.length) + 8 };
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

/** The drawing of one end: two bars for one, a crow's foot for many. `toward` is the line's other end. */
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
  if (end === 'one') return `${bar(7)} ${bar(12)}`;
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
