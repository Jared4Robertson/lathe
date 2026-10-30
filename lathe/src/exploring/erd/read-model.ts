// The ERD read model (LA-EXP-RM04), shaped for the ERD stage: one entity-relationship diagram of a whole product.
// Each domain is a region; its aggregates are areas inside it, each a boundary around its entities (the root first),
// each entity with its fields and their types. A domain with no aggregates, and an aggregate with no entities, is a
// closed box that says so. A has one or has many line joins two entities; a dashed reference-by-ID line runs from an
// entity holding a field typed by another aggregate to that aggregate's root (or its closed box when it has none),
// across regions when the aggregate is another domain's. The app lays it out and draws it (app/src/erd). The
// projection is the only code that reads the source rows for the query and the only code that writes the table.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';

/** A line end: exactly one (two bars), many (a crow's foot), none (a plain end) or an arrowhead (the aggregate a reference points at). */
export type ErdEnd = 'one' | 'many' | 'none' | 'arrow';
/** What a box is: a domain's region, an aggregate (a boundary around its entities) or an entity. */
export type ErdKind = 'domain' | 'aggregate' | 'entity';
/** What a line stands for: a stored `has_one` or `has_many` link, or a field typed by another aggregate (`references`). */
export type ErdRelation = 'has_one' | 'has_many' | 'references';

/** The ends each line draws, at its source and its target. */
const RELATION_ENDS: Record<ErdRelation, [ErdEnd, ErdEnd]> = {
  has_one: ['one', 'one'],
  has_many: ['one', 'many'],
  references: ['none', 'arrow'],
};

export interface ErdField { field: string; kind: string }

export interface ErdBox {
  id: string;
  kind: ErdKind;
  title: string;
  /** An entity that is its aggregate's root. */
  root: boolean;
  /** An entity's fields with their types: its basic type, its value object's title, or "→ Aggregate" for a reference. */
  fields: ErdField[];
  /** The box it sits in: an entity's aggregate, an aggregate's domain; none for a domain. */
  parent?: string;
  /** A domain with no aggregates, or an aggregate with no entities. */
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
  /** The fields a reference stands for ("Loan.Member"). */
  via: string[];
}

/** A product's whole ERD. */
export interface ErdMap {
  product: string;
  boxes: ErdBox[];
  lines: ErdLine[];
}

/** The read model's table, kept in memory: each product's map, by product. */
export interface ErdTable {
  products: Map<string, ErdMap>;
}

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, 'en', { numeric: true });
const str = (row: Row, column: string) => (typeof row[column] === 'string' ? (row[column] as string) : '');

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function erdTableFrom(view: ReadView): ErdTable {
  const titles = new Map<string, string>();
  for (const kind of ['value_object', 'aggregate']) for (const r of view.rows(kind)) titles.set(String(r.id), str(r, 'title'));
  const aggregatesOf = new Map<string, Row[]>();
  for (const a of view.rows('aggregate')) aggregatesOf.set(str(a, 'domain_id'), [...(aggregatesOf.get(str(a, 'domain_id')) ?? []), a]);
  const entitiesOf = new Map<string, Row[]>();
  for (const e of view.rows('entity')) entitiesOf.set(str(e, 'aggregate_id'), [...(entitiesOf.get(str(e, 'aggregate_id')) ?? []), e]);
  const fieldsOf = new Map<string, Row[]>();
  for (const f of view.rows('entity_field')) fieldsOf.set(str(f, 'entity_id'), [...(fieldsOf.get(str(f, 'entity_id')) ?? []), f]);
  const linksOf = new Map<string, { relation: 'has_one' | 'has_many'; target: string }[]>();
  for (const relation of ['has_one', 'has_many'] as const) {
    for (const l of view.schema.tables[relation] ? view.rows(relation) : []) linksOf.set(String(l.source_id), [...(linksOf.get(String(l.source_id)) ?? []), { relation, target: String(l.target_id) }]);
  }
  const fieldType = (f: Row) => {
    const vo = str(f, 'type_value_object_id');
    if (vo) return titles.get(vo) ?? vo;
    const aggregate = str(f, 'type_aggregate_id');
    if (aggregate) return `→ ${titles.get(aggregate) ?? aggregate}`;
    return str(f, 'type');
  };
  const sortedRows = (rows: Row[]) => [...rows].sort((a, b) => byId({ id: String(a.id) }, { id: String(b.id) }));

  const products = new Map<string, ErdMap>();
  for (const p of view.rows('product')) {
    const product = String(p.id);
    const boxes = new Map<string, ErdBox>();
    const lines = new Map<string, ErdLine>();
    const domains = sortedRows(view.rows('domain').filter((d) => str(d, 'product_id') === product));
    for (const d of domains) {
      const aggregates = sortedRows(aggregatesOf.get(String(d.id)) ?? []);
      boxes.set(String(d.id), { id: String(d.id), kind: 'domain', title: str(d, 'title'), root: false, fields: [], empty: aggregates.length === 0 });
      for (const a of aggregates) {
        const entities = sortedRows(entitiesOf.get(String(a.id)) ?? []).sort((x, y) => Number(str(y, 'role') === 'root') - Number(str(x, 'role') === 'root'));
        boxes.set(String(a.id), { id: String(a.id), kind: 'aggregate', title: str(a, 'title'), root: false, fields: [], parent: String(d.id), empty: entities.length === 0 });
        for (const e of entities) {
          boxes.set(String(e.id), {
            id: String(e.id), kind: 'entity', title: str(e, 'title'), root: str(e, 'role') === 'root', parent: String(a.id), empty: false,
            fields: (fieldsOf.get(String(e.id)) ?? []).map((f) => ({ field: str(f, 'name'), kind: fieldType(f) })),
          });
        }
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
    const rootOf = new Map<string, string>();
    for (const b of boxes.values()) if (b.kind === 'entity' && b.root && b.parent) rootOf.set(b.parent, b.id);
    const entities = [...boxes.values()].filter((b) => b.kind === 'entity');
    for (const e of entities) {
      const links = [...(linksOf.get(e.id) ?? [])].sort((a, b) => a.relation.localeCompare(b.relation) || byId({ id: a.target }, { id: b.target }));
      for (const relation of ['has_one', 'has_many'] as const) for (const l of links.filter((x) => x.relation === relation)) line(e.id, relation, l.target);
    }
    for (const e of entities) {
      for (const f of fieldsOf.get(e.id) ?? []) {
        const target = str(f, 'type_aggregate_id');
        if (!target || target === e.parent || !boxes.has(target)) continue;
        line(e.id, 'references', rootOf.get(target) ?? target, [`${e.title}.${str(f, 'name')}`]);
      }
    }
    products.set(product, { product, boxes: [...boxes.values()], lines: [...lines.values()] });
  }
  return { products };
}
