import type { SpecIndex, SpecLink, SpecRecord } from '../specs/data';
import { textOf, byIdOrder, partsOf } from '../specs/data';
import { eventAggregate, eventsOf, raisedByLinks, reactingAggregates, reactionsOf } from './events';

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
// - Context (LA-EXP-UC11-R06): on an aggregate's ERD, the entities that its referenced entities
//   refer to sit one ring out, faded and out of focus; on a domain's ERD, the aggregates of other
//   domains are context too. The camera frames the boxes in focus only.
// - Domain events (LA-EXP-UC11-R07, R08): on an aggregate's ERD, each of its events is a flag beside
//   its entities, with a short line from the entity that raises it (`raised_by`), and the aggregates
//   that react to it, from this domain or another, are faded context at the end of a dashed
//   "reacts to" line. On a domain's ERD, a dashed "reacts to" line runs from the aggregate raising
//   an event to each aggregate reacting to it: one line per aggregate pair and event (LA-EXP-DR51).

export type ErdLevel = 'domain' | 'aggregate';
/** A line end: exactly one (two bars), many (a crow's foot), none (a plain end) or an arrowhead (where an event leads). */
export type ErdEnd = 'one' | 'many' | 'none' | 'arrow';
/** Who owns a box: the current domain (blue) or another one (gray). */
export type ErdTone = 'current' | 'other';

export const ENTITY_RELATIONS = ['has_one', 'has_many', 'refers_to'] as const;
export type EntityRelation = (typeof ENTITY_RELATIONS)[number];
/** What an ERD line stands for: an entity relationship, the aggregates' fallback, or an event's link. */
export type ErdRelation = EntityRelation | 'relates_to' | 'raised_by' | 'reacts_to';

/** The ends each relationship draws, at its source and its target (as drawn: an event's lines run from cause to effect). */
export const RELATION_ENDS: Record<ErdRelation, [ErdEnd, ErdEnd]> = {
  has_one: ['one', 'one'],
  has_many: ['one', 'many'],
  refers_to: ['many', 'one'],
  relates_to: ['many', 'one'],
  raised_by: ['none', 'none'],
  reacts_to: ['none', 'arrow'],
};

export interface ErdField { field: string; kind: string }

export interface ErdBox {
  id: string;
  /** 'aggregate' on a domain's ERD (and a reacting aggregate on an aggregate's); 'entity', or 'event' for a domain event's flag, on an aggregate's. */
  kind: 'aggregate' | 'entity' | 'event';
  title: string;
  /** The owner in parentheses for a box from elsewhere: "(Loan)" or "(Lending · Loan)"; null for the diagram's own boxes. */
  owner: string | null;
  tone: ErdTone;
  /** True for a box outside the diagram's own aggregate or domain. */
  foreign: boolean;
  /** An entity that is its aggregate's root. */
  root: boolean;
  /** An entity's or an event's fields (empty for an aggregate and a foreign entity). */
  fields: ErdField[];
  /** An aggregate's root entity's title, and how many entities it holds. */
  rootTitle?: string | null;
  entities?: number;
  /** The record the page is about, highlighted (an entity on its own page). */
  highlight: boolean;
  /** One ring out: drawn faded, out of focus and out of the keyboard order. */
  context: boolean;
}

export interface ErdLine {
  id: string;
  source: string;
  target: string;
  relation: ErdRelation;
  sourceEnd: ErdEnd;
  targetEnd: ErdEnd;
  /** A fallback `relates_to` line between aggregates, or a `reacts_to` line. */
  dashed: boolean;
  /** The links the line stands for: one on an aggregate's ERD; every entity reference between the pair on a domain's. */
  links: SpecLink[];
  /**
   * The line runs against its link, drawn from cause to effect: from an entity to the event it
   * raises (the link is the event's `raised_by`), and from an event to an aggregate reacting to it
   * (the link is the aggregate's `reacts_to`).
   */
  reversed?: boolean;
  /** On a domain's ERD, a `reacts_to` line's event: its name is the line's label on hover. */
  event?: { id: string; title: string };
  /** To or between context boxes: drawn faded. */
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

const isEntityRelation = (r: string): r is EntityRelation => (ENTITY_RELATIONS as readonly string[]).includes(r);

/** An aggregate's entities: the root first, then the children, in ID order. */
export function entitiesOf(index: SpecIndex, aggregate: string): SpecRecord[] {
  const entities = (index.children.get(aggregate) ?? []).filter((r) => r.kind === 'entity');
  const isRoot = (r: SpecRecord) => textOf(r.row, 'role')?.trim().toLowerCase() === 'root';
  return [...entities].sort((a, b) => Number(isRoot(b)) - Number(isRoot(a)) || byIdOrder(a, b));
}

const isRootEntity = (r: SpecRecord) => textOf(r.row, 'role')?.trim().toLowerCase() === 'root';

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
  // A domain event: its aggregate's ERD, with its flag picked out.
  if (record.kind === 'domain_event') {
    const aggregate = eventAggregate(index, record);
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

/** An aggregate's box: its title, root entity and entity count; gray and named with its domain when it is another domain's. */
function aggregateBoxOf(index: SpecIndex, a: SpecRecord, domainId: string, context: boolean, foreign = a.domain !== domainId): ErdBox {
  const entities = entitiesOf(index, a.id);
  const root = entities.find(isRootEntity) ?? null;
  const otherDomain = a.domain !== domainId;
  return {
    id: a.id,
    kind: 'aggregate',
    title: a.title,
    owner: otherDomain ? `(${titleOf(index, a.domain)})` : null,
    tone: otherDomain ? 'other' : 'current',
    foreign,
    root: false,
    fields: [],
    rootTitle: root?.title ?? null,
    entities: entities.length,
    highlight: false,
    context,
  };
}

/** A domain's ERD at aggregate level. */
export function domainErd(index: SpecIndex, domainId: string): Erd {
  const aggregates = (index.children.get(domainId) ?? []).filter((r) => r.kind === 'aggregate');
  const boxes = new Map<string, ErdBox>();
  // Another domain's aggregate is context: gray, and faded too.
  const aggregateBox = (a: SpecRecord): ErdBox => aggregateBoxOf(index, a, domainId, a.domain !== domainId);
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
        else lines.set(id, { id, source: a.id, target: other.id, relation: 'refers_to', sourceEnd: 'many', targetEnd: 'one', dashed: false, links: [l], context: other.domain !== domainId });
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
      if (!lines.has(id)) lines.set(id, { id, source: a.id, target: other.id, relation: 'relates_to', sourceEnd: 'many', targetEnd: 'one', dashed: true, links: [l], context: other.domain !== domainId });
    }
  }
  // Cause and effect: a dashed line from the aggregate raising an event to each aggregate reacting
  // to it, one per pair and event. An aggregate reacting to its own event draws no line.
  const [causeEnd, effectEnd] = RELATION_ENDS.reacts_to;
  const reactsLine = (raiser: SpecRecord, event: SpecRecord, reactor: SpecRecord, link: SpecLink) => {
    if (raiser.id === reactor.id) return;
    for (const a of [raiser, reactor]) if (!boxes.has(a.id)) boxes.set(a.id, aggregateBox(a));
    const id = `${raiser.id}|reacts_to|${reactor.id}|${event.id}`;
    if (lines.has(id)) return;
    lines.set(id, {
      id, source: raiser.id, target: reactor.id, relation: 'reacts_to', sourceEnd: causeEnd, targetEnd: effectEnd, dashed: true, links: [link],
      context: raiser.domain !== domainId || reactor.domain !== domainId, event: { id: event.id, title: event.title },
    });
  };
  for (const a of aggregates) {
    // Its own events, and whatever aggregate reacts to them, here or in another domain.
    for (const event of eventsOf(index, a.id)) {
      for (const { aggregate: reactor, link } of reactingAggregates(index, event.id)) reactsLine(a, event, reactor, link);
    }
    // Another domain's events it reacts to.
    for (const { event, link } of reactionsOf(index, a.id)) {
      const raiser = eventAggregate(index, event);
      if (raiser && raiser.domain !== domainId) reactsLine(raiser, event, a, link);
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
      fields: partsOf(index, e.id, 'entity_field').map((f) => ({ field: textOf(f, 'name'), kind: textOf(f, 'type') })),
      highlight: e.id === highlight,
      context: false,
    });
  }
  // Its domain events: flags beside its entities.
  const events = eventsOf(index, aggregateId);
  for (const ev of events) {
    boxes.set(ev.id, {
      id: ev.id,
      kind: 'event',
      title: ev.title,
      owner: null,
      tone: 'current',
      foreign: false,
      root: false,
      fields: partsOf(index, ev.id, 'event_field').map((f) => ({ field: textOf(f, 'name'), kind: textOf(f, 'type') })),
      highlight: ev.id === highlight,
      context: false,
    });
  }
  const lines: ErdLine[] = [];
  const foreignBox = (target: SpecRecord, context: boolean): ErdBox => {
    const other = aggregateOf(index, target);
    const sameDomain = target.domain === domainId;
    const aggTitle = other?.title ?? '';
    return {
      id: target.id,
      kind: 'entity',
      title: target.title,
      owner: sameDomain ? `(${aggTitle})` : `(${titleOf(index, target.domain)} · ${aggTitle})`,
      tone: sameDomain ? 'current' : 'other',
      foreign: true,
      root: isRootEntity(target),
      fields: [],
      highlight: false,
      context,
    };
  };
  /** The entity relationships an entity holds, to entities, one line each. */
  const linesFrom = (e: SpecRecord, context: boolean, reached: SpecRecord[]) => {
    for (const l of index.outgoing.get(e.id) ?? []) {
      if (!isEntityRelation(l.relation)) continue;
      const target = index.byId.get(l.target);
      if (target?.kind !== 'entity') continue;
      if (!boxes.has(target.id)) {
        boxes.set(target.id, foreignBox(target, context));
        reached.push(target);
      }
      const [sourceEnd, targetEnd] = RELATION_ENDS[l.relation];
      // A referenced entity's own relationships belong to its aggregate's ERD: here they are context, faded.
      lines.push({ id: `${e.id}|${l.relation}|${target.id}`, source: e.id, target: target.id, relation: l.relation, sourceEnd, targetEnd, dashed: false, links: [l], context });
    }
  };
  const referenced: SpecRecord[] = [];
  for (const e of own) linesFrom(e, false, referenced);
  // One ring out: what the referenced entities refer to, faded; the ring stops there.
  for (const e of [...referenced].sort(byIdOrder)) linesFrom(e, true, []);
  // Each event: a short line from the entity raising it, and a dashed line to each aggregate
  // reacting to it, which is faded context (another domain's gray, named in parentheses).
  for (const ev of events) {
    for (const l of raisedByLinks(index, ev.id)) {
      const entity = boxes.get(l.target);
      if (!entity || entity.foreign) continue;
      const [sourceEnd, targetEnd] = RELATION_ENDS.raised_by;
      lines.push({ id: `${l.target}|raised_by|${ev.id}`, source: l.target, target: ev.id, relation: 'raised_by', sourceEnd, targetEnd, dashed: false, links: [l], context: false, reversed: true });
    }
    for (const { aggregate: reactor, link } of reactingAggregates(index, ev.id)) {
      if (reactor.id === aggregateId) continue;
      if (!boxes.has(reactor.id)) boxes.set(reactor.id, aggregateBoxOf(index, reactor, domainId, true, true));
      const [sourceEnd, targetEnd] = RELATION_ENDS.reacts_to;
      lines.push({ id: `${ev.id}|reacts_to|${reactor.id}`, source: ev.id, target: reactor.id, relation: 'reacts_to', sourceEnd, targetEnd, dashed: true, links: [link], context: true, reversed: true });
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
export const EVENT_FLAG = { width: 190, height: 48 };

/** A box's size: an aggregate's and an event's are fixed; an entity's grows with its fields. */
export function boxSize(box: ErdBox): { width: number; height: number } {
  if (box.kind === 'aggregate') return AGGREGATE_BOX;
  if (box.kind === 'event') return EVENT_FLAG;
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
    // Dashed "reacts to" lines sit wider apart, so each one is easy to point at for its label.
    const step = group.some((l) => l.relation === 'reacts_to') ? gap * 1.6 : gap;
    group.forEach((l, i) => {
      // Measured from the pair in sorted order, so lines pointing either way fan out on one axis.
      const flipped = l.source > l.target ? -1 : 1;
      out.set(l.id, (i - (group.length - 1) / 2) * step * flipped);
    });
  }
  return out;
}
