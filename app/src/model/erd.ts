import type { Row, SpecIndex, SpecRecord } from '../specs/data';
import { textOf, byIdOrder, partsOf } from '../specs/data';
import { commandsOf, eventsOf, hearingPolicies, heardEvent, policiesOf, raisedEvents } from './events';

// The Model view's diagrams, as plain data (no React): what boxes and lines a domain's or an
// aggregate's model draws, in event storming colors.
//
// - A domain's model: one box per aggregate (yellow), listing its entities (the root marked) and the
//   value objects their fields use; a many-to-one line from an aggregate to each aggregate its
//   entities' fields refer to by ID (another domain's gray and faded, named in parentheses). Around
//   the aggregates, in event storming order left to right: policies (lilac) invoking their command,
//   commands (blue) changing their aggregate and raising events (orange), and the events heard by
//   policies, which closes the loop; specifications (pink) that commands check and that read
//   aggregates; read models (green) reading aggregates, with their queries and the specifications they
//   select by. A policy hearing another domain's published event shows that event as faded context,
//   and so does another domain's policy hearing one of this domain's events.
// - An aggregate's model: its entities with their fields and each field's type (a basic type, a value
//   object's title, or a reference to an aggregate), has_one and has_many lines with crow's feet,
//   the aggregates its fields refer to as faded context; its commands, the events they raise, the
//   policies invoking them, and the specifications they check; the policies hearing its events, and
//   the events its policies hear from elsewhere, as context. An entity, command, event or policy page
//   draws its aggregate's model with that record highlighted; a read model, query or specification
//   page draws its domain's.

export type ErdLevel = 'domain' | 'aggregate';
/** A line end: exactly one (two bars), many (a crow's foot), none (a plain end) or an arrowhead (where a flow leads). */
export type ErdEnd = 'one' | 'many' | 'none' | 'arrow';
/** Who owns a box: the current domain or another one (gray, named in parentheses). */
export type ErdTone = 'current' | 'other';
/** What a box is: a kind of record, each drawn in its event storming color. */
export type ErdKind = 'aggregate' | 'entity' | 'command' | 'event' | 'policy' | 'specification' | 'read_model' | 'query';

/**
 * What a line stands for: a stored relation (`has_one`, `has_many`, `raises`, `hears`, `checks`, `reads`,
 * `selects_by`), or what the tree and the fields say (`refers_to`: a field typed by another aggregate;
 * `changes`: a command's own aggregate; `also_changes`: a recorded exception; `invokes`: a policy's command;
 * `queries`: a read model's query).
 */
export type ErdRelation = 'has_one' | 'has_many' | 'refers_to' | 'changes' | 'also_changes' | 'raises' | 'hears' | 'invokes' | 'checks' | 'reads' | 'queries' | 'selects_by';

/** The ends each line draws, at its source and its target, as drawn. */
export const RELATION_ENDS: Record<ErdRelation, [ErdEnd, ErdEnd]> = {
  has_one: ['one', 'one'],
  has_many: ['one', 'many'],
  refers_to: ['many', 'one'],
  changes: ['none', 'arrow'],
  also_changes: ['none', 'arrow'],
  raises: ['none', 'arrow'],
  hears: ['none', 'arrow'],
  invokes: ['none', 'arrow'],
  checks: ['none', 'arrow'],
  reads: ['none', 'arrow'],
  queries: ['none', 'arrow'],
  selects_by: ['none', 'arrow'],
};

/** The lines drawn dashed: a policy hearing an event (it follows later, through the outbox) and a recorded exception. */
const DASHED: ReadonlySet<ErdRelation> = new Set(['hears', 'also_changes']);

/** The words of the lines that stand for no stored relation, read from the line's source. */
export const LINE_WORDS: Partial<Record<ErdRelation, string>> = {
  refers_to: 'refers to',
  changes: 'changes',
  also_changes: 'also changes',
  invokes: 'invokes',
  queries: 'is queried by',
};

export interface ErdField { field: string; kind: string }

export interface ErdBox {
  id: string;
  kind: ErdKind;
  title: string;
  /** The owner in parentheses for a box from elsewhere: "(Accounts)" or "(Accounts · Account)"; null for the diagram's own boxes. */
  owner: string | null;
  tone: ErdTone;
  /** True for a box of another domain. */
  foreign: boolean;
  /** An entity that is its aggregate's root. */
  root: boolean;
  /** An entity's, event's or read model's fields with their types (empty for the other kinds and for a box from elsewhere). */
  fields: ErdField[];
  /** On a domain's model, an aggregate's entities, the root first. */
  entities?: { id: string; title: string; root: boolean }[];
  /** On a domain's model, the titles of the value objects an aggregate's entities use. */
  valueObjects?: string[];
  /** The box it belongs to in the diagram, when that is drawn: an event's aggregate, a query's read model. */
  parent?: string;
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
  /** What the line stands for, in words for its tooltip: the referring fields ("Loan.Member"), or a recorded exception's reason. */
  via: string[];
  /**
   * The line runs against its link, drawn from cause to effect: from an event to the policy hearing
   * it (the link is the policy's `hears`), from an aggregate to the read model reading it.
   */
  reversed?: boolean;
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

const isRootEntity = (r: SpecRecord) => textOf(r.row, 'role') === 'root';
const parentOf = (index: SpecIndex, r: SpecRecord | undefined) => (r?.parent ? index.byId.get(r.parent) : undefined);
const childrenOfKind = (index: SpecIndex, id: string, kind: string) => (index.children.get(id) ?? []).filter((r) => r.kind === kind).sort(byIdOrder);
const titleOf = (index: SpecIndex, id: string | null) => (id ? index.byId.get(id)?.title ?? id : '');
const targets = (index: SpecIndex, id: string, relation: string) =>
  (index.outgoing.get(id) ?? []).filter((l) => l.relation === relation).map((l) => index.byId.get(l.target)).filter((r): r is SpecRecord => !!r).sort(byIdOrder);

/** An aggregate's entities: the root first, then the children, in ID order. */
export function entitiesOf(index: SpecIndex, aggregate: string): SpecRecord[] {
  return [...childrenOfKind(index, aggregate, 'entity')].sort((a, b) => Number(isRootEntity(b)) - Number(isRootEntity(a)) || byIdOrder(a, b));
}

/** The aggregate a record sits under (itself for an aggregate): an entity's, event's or command's, a policy's command's. */
export function aggregateOf(index: SpecIndex, record: SpecRecord | undefined): SpecRecord | null {
  for (let r = record, seen = 0; r && seen < 8; r = parentOf(index, r), seen++) if (r.kind === 'aggregate') return r;
  return null;
}

/** A field's type in words: its basic type, its value object's title, or "→ Aggregate" for a reference. */
export function fieldType(index: SpecIndex, field: Row): string {
  const vo = textOf(field, 'type_value_object_id');
  if (vo) return titleOf(index, vo);
  const aggregate = textOf(field, 'type_aggregate_id');
  if (aggregate) return `→ ${titleOf(index, aggregate)}`;
  return textOf(field, 'type');
}

const fieldsOf = (index: SpecIndex, id: string, table: string): ErdField[] =>
  partsOf(index, id, table).map((f) => ({ field: textOf(f, 'name'), kind: fieldType(index, f) }));

/** The value objects an aggregate's entities' fields use, in ID order. */
function valueObjectsOf(index: SpecIndex, aggregate: string): SpecRecord[] {
  const ids = new Set(entitiesOf(index, aggregate).flatMap((e) => partsOf(index, e.id, 'entity_field').map((f) => textOf(f, 'type_value_object_id')).filter(Boolean)));
  return [...ids].map((id) => index.byId.get(id)).filter((r): r is SpecRecord => !!r).sort(byIdOrder);
}

/** The aggregates an aggregate's entities refer to by ID, other than itself, each with the fields that refer ("Loan.Member"). */
export function referencesOf(index: SpecIndex, aggregate: string): { target: SpecRecord; via: string[]; from: string[] }[] {
  const found = new Map<string, { target: SpecRecord; via: string[]; from: string[] }>();
  for (const e of entitiesOf(index, aggregate)) {
    for (const f of partsOf(index, e.id, 'entity_field')) {
      const id = textOf(f, 'type_aggregate_id');
      const target = id ? index.byId.get(id) : undefined;
      if (!target || target.id === aggregate) continue;
      const entry = found.get(id) ?? { target, via: [], from: [] };
      entry.via.push(`${e.title}.${textOf(f, 'name')}`);
      if (!entry.from.includes(e.id)) entry.from.push(e.id);
      found.set(id, entry);
    }
  }
  return [...found.values()].sort((a, b) => byIdOrder(a.target, b.target));
}

/** What the Model view draws for a page: a domain's model, or an aggregate's; null for any other page. */
export function modelScope(index: SpecIndex, focus: string): { level: ErdLevel; scope: string; highlight: string | null } | null {
  const record = index.byId.get(focus);
  if (!record) return null;
  if (record.kind === 'domain') return { level: 'domain', scope: record.id, highlight: null };
  if (['aggregate', 'entity', 'command', 'domain_event', 'policy'].includes(record.kind)) {
    const aggregate = aggregateOf(index, record);
    return aggregate ? { level: 'aggregate', scope: aggregate.id, highlight: record.kind === 'aggregate' ? null : record.id } : null;
  }
  if (['read_model', 'query', 'specification'].includes(record.kind) && record.domain) return { level: 'domain', scope: record.domain, highlight: record.id };
  return null;
}

/** The diagram for a page, or null when the page has none. */
export function erdFor(index: SpecIndex, focus: string): Erd | null {
  const scope = modelScope(index, focus);
  if (!scope) return null;
  return scope.level === 'domain' ? domainErd(index, scope.scope, scope.highlight) : aggregateErd(index, scope.scope, scope.highlight);
}

/** Builds a diagram's boxes and lines, each once. */
class Builder {
  boxes = new Map<string, ErdBox>();
  lines = new Map<string, ErdLine>();
  constructor(private index: SpecIndex, private domainId: string, private highlight: string | null) {}

  /** A record's box: the current domain's, or another's (gray, its domain in parentheses), in focus or faded. */
  box(record: SpecRecord, kind: ErdKind, extra: Partial<ErdBox> = {}, context = false): ErdBox {
    const known = this.boxes.get(record.id);
    if (known) return known;
    const otherDomain = !!record.domain && record.domain !== this.domainId;
    const box: ErdBox = {
      id: record.id,
      kind,
      title: record.title,
      owner: otherDomain ? `(${titleOf(this.index, record.domain)})` : null,
      tone: otherDomain ? 'other' : 'current',
      foreign: otherDomain,
      root: false,
      fields: [],
      highlight: record.id === this.highlight,
      context: context || otherDomain,
      ...extra,
    };
    this.boxes.set(record.id, box);
    return box;
  }

  line(source: string, relation: ErdRelation, target: string, options: { via?: string[]; reversed?: boolean } = {}) {
    if (source === target || !this.boxes.has(source) || !this.boxes.has(target)) return;
    const id = `${source}|${relation}|${target}`;
    const known = this.lines.get(id);
    if (known) { known.via.push(...(options.via ?? [])); return; }
    const [sourceEnd, targetEnd] = RELATION_ENDS[relation];
    const context = this.boxes.get(source)!.context || this.boxes.get(target)!.context;
    this.lines.set(id, { id, source, target, relation, sourceEnd, targetEnd, dashed: DASHED.has(relation), via: [...(options.via ?? [])], reversed: options.reversed, context });
  }

  done(level: ErdLevel, scope: string): Erd {
    return { level, scope, domain: this.domainId, boxes: [...this.boxes.values()], lines: [...this.lines.values()] };
  }
}

/** A command's box with what it raises and checks and the policies invoking it, each event's hearers, lines included. */
function commandAround(index: SpecIndex, b: Builder, command: SpecRecord, aggregateBox: string, scopeAggregate: string | null) {
  b.box(command, 'command');
  b.line(command.id, 'changes', aggregateBox);
  for (const change of partsOf(index, command.id, 'command_change')) {
    const other = index.byId.get(textOf(change, 'aggregate_id'));
    if (!other) continue;
    b.box(other, 'aggregate', {}, true);
    b.line(command.id, 'also_changes', other.id, { via: [textOf(change, 'reason')] });
  }
  for (const event of raisedEvents(index, command.id)) {
    const owner = aggregateOf(index, event);
    b.box(event, 'event', owner && b.boxes.has(owner.id) ? { parent: owner.id } : {});
    b.line(command.id, 'raises', event.id);
  }
  for (const policy of policiesOf(index, command.id)) {
    b.box(policy, 'policy');
    b.line(policy.id, 'invokes', command.id);
    const heard = heardEvent(index, policy.id);
    if (heard) {
      // On an aggregate's model, an event of another aggregate is context.
      const elsewhere = !!scopeAggregate && aggregateOf(index, heard)?.id !== scopeAggregate;
      const owner = aggregateOf(index, heard);
      b.box(heard, 'event', owner && b.boxes.has(owner.id) ? { parent: owner.id } : {}, elsewhere);
      b.line(heard.id, 'hears', policy.id, { reversed: true });
    }
  }
  for (const spec of targets(index, command.id, 'checks')) {
    b.box(spec, 'specification');
    b.line(command.id, 'checks', spec.id);
  }
}

/** A domain's model: its aggregates and what sits around them. */
export function domainErd(index: SpecIndex, domainId: string, highlight: string | null = null): Erd {
  const b = new Builder(index, domainId, highlight);
  const aggregates = childrenOfKind(index, domainId, 'aggregate');
  for (const a of aggregates) {
    b.box(a, 'aggregate', {
      entities: entitiesOf(index, a.id).map((e) => ({ id: e.id, title: e.title, root: isRootEntity(e) })),
      valueObjects: valueObjectsOf(index, a.id).map((v) => v.title),
    });
  }
  for (const a of aggregates) {
    for (const ref of referencesOf(index, a.id)) {
      b.box(ref.target, 'aggregate');
      b.line(a.id, 'refers_to', ref.target.id, { via: ref.via });
    }
  }
  for (const a of aggregates) for (const c of commandsOf(index, a.id)) commandAround(index, b, c, a.id, null);
  // Events no command raises yet still belong on the board.
  for (const a of aggregates) for (const e of eventsOf(index, a.id)) b.box(e, 'event', { parent: a.id });
  // Another domain's policies hearing this domain's events: faded context.
  for (const a of aggregates) {
    for (const e of eventsOf(index, a.id)) {
      for (const p of hearingPolicies(index, e.id)) {
        if (p.domain === domainId) continue;
        b.box(p, 'policy');
        b.line(e.id, 'hears', p.id, { reversed: true });
      }
    }
  }
  // Specifications reading the domain's aggregates (a specification belongs to the domain its ID names).
  const specs = index.workspace.records.filter((r) => r.kind === 'specification' && r.domain === domainId).sort(byIdOrder);
  for (const s of specs) {
    b.box(s, 'specification');
    for (const a of targets(index, s.id, 'reads')) b.line(s.id, 'reads', a.id);
  }
  // Read models reading the aggregates, and their queries.
  for (const rm of childrenOfKind(index, domainId, 'read_model')) {
    b.box(rm, 'read_model', { fields: fieldsOf(index, rm.id, 'read_model_field') });
    for (const a of targets(index, rm.id, 'reads')) b.line(a.id, 'reads', rm.id, { reversed: true });
    for (const q of childrenOfKind(index, rm.id, 'query')) {
      b.box(q, 'query', { parent: rm.id });
      b.line(rm.id, 'queries', q.id);
      for (const s of targets(index, q.id, 'selects_by')) {
        b.box(s, 'specification');
        b.line(q.id, 'selects_by', s.id);
      }
    }
  }
  return b.done('domain', domainId);
}

/** An aggregate's model: its entities, fields and relationships, and the commands, events and policies around it. */
export function aggregateErd(index: SpecIndex, aggregateId: string, highlight: string | null = null): Erd {
  const aggregate = index.byId.get(aggregateId);
  const domainId = aggregate?.domain ?? '';
  const b = new Builder(index, domainId, highlight);
  const own = entitiesOf(index, aggregateId);
  for (const e of own) b.box(e, 'entity', { root: isRootEntity(e), fields: fieldsOf(index, e.id, 'entity_field') });
  for (const e of own) {
    for (const relation of ['has_one', 'has_many'] as const) {
      for (const t of targets(index, e.id, relation)) {
        if (!b.boxes.has(t.id)) continue;
        b.line(e.id, relation, t.id);
      }
    }
  }
  // The aggregates its fields refer to: faded context, from each referring entity.
  for (const ref of referencesOf(index, aggregateId)) {
    b.box(ref.target, 'aggregate', {}, true);
    for (const from of ref.from) {
      const entity = index.byId.get(from)!;
      b.line(from, 'refers_to', ref.target.id, { via: ref.via.filter((v) => v.startsWith(`${entity.title}.`)) });
    }
  }
  const root = own.find((e) => isRootEntity(e)) ?? own[0];
  const target = root?.id ?? aggregateId;
  if (!root && aggregate) b.box(aggregate, 'aggregate');
  for (const e of eventsOf(index, aggregateId)) b.box(e, 'event', { fields: fieldsOf(index, e.id, 'event_field'), parent: target });
  for (const c of commandsOf(index, aggregateId)) commandAround(index, b, c, target, aggregateId);
  // The policies elsewhere hearing its events: faded context.
  for (const e of eventsOf(index, aggregateId)) {
    for (const p of hearingPolicies(index, e.id)) {
      if (b.boxes.has(p.id)) continue;
      b.box(p, 'policy', {}, true);
      b.line(e.id, 'hears', p.id, { reversed: true });
    }
  }
  return b.done('aggregate', aggregateId);
}

// ---------- Geometry ----------

export type Point = { x: number; y: number };
export interface Rect { x: number; y: number; width: number; height: number }

/** A box with rows (fields, entities), and a sticky note (a command, policy, specification or query with none). */
export const BOX_WIDTH = 230;
export const STICKY_WIDTH = 200;
/** The parts of a box's height, in CSS pixels at the default text size (styles.css .erd-box): its padding and border, a title line, the kind line, a row, and the rows' rule. */
const FRAME = 22;
const TITLE_LINE = 16;
const KIND_LINE = 14;
export const ROW = 20;
const ROWS_RULE = 11;
/** About how many characters of a title fit on a line, by box width (the display face's bold at 0.8125rem). */
const charsPerLine = (width: number) => Math.floor((width - 20) / 7.6);

/** The rows a box lists: an entity's, event's or read model's fields; an aggregate's entities and its value objects' line. */
export const boxRows = (box: ErdBox) => (box.kind === 'aggregate' ? (box.entities?.length ?? 0) + (box.valueObjects?.length ? 1 : 0) : box.fields.length);

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

/** A box's size: a sticky note for a kind without rows; a box with rows grows with them. Each fits its title on up to two lines. */
export function boxSize(box: ErdBox): { width: number; height: number } {
  const rows = boxRows(box);
  const width = rows === 0 ? STICKY_WIDTH : BOX_WIDTH;
  const head = FRAME + TITLE_LINE * titleLines(box.title, width, box.root) + KIND_LINE;
  return { width, height: rows === 0 ? head : head + ROWS_RULE + ROW * rows };
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
