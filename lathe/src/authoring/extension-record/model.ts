// The Extension record aggregate (LA-AUT-A19): one record of a kind a product declares as its own, with the links it
// starts and the packages it uses. Its shape is its kind's declaration (product_kind and product_kind_field rows): its
// table, its parent column and its fields come from the schema the declaration builds, not from code. One instance is
// one record, whole; a record of another product kind under it is an instance of its own.
import type { Slice } from '../../platform/commands/definition.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import type { KindDescription, SchemaDescription } from '../../platform/data/schema.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const EXTENSION_RECORD_AGGREGATE = 'LA-AUT-A19';

/** How the interfaces reach the aggregate's commands: `lathe extension-record`, the extension_record_ tools, /api/extension-record/. */
export const EXTENSION_RECORD_SLICE: Slice = { aggregate: EXTENSION_RECORD_AGGREGATE, name: 'extension-record' };

/** One record of a product's own kind, whole. */
export interface ExtensionRecord {
  /** The record's ID: the aggregate's root. */
  readonly root: string;
  /** Its kind: a product kind's name, which is also its table's. */
  kind: string;
  row: Row;
  /** The records it links to, by relation: only relations its kind may start, each list sorted. */
  links: Record<string, string[]>;
  /** The packages it uses (package_use), sorted. */
  packages: string[];
}

/** The kinds the products declare, by name. */
export function productKinds(schema: SchemaDescription): KindDescription[] {
  return Object.values(schema.kinds)
    .filter((k) => k.productId !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The relations a record of the kind may start: those with a pair from the kind. */
export function startedRelations(schema: SchemaDescription, kind: string): string[] {
  return Object.values(schema.relations)
    .filter((r) => r.pairs.some((p) => p.source === kind))
    .map((r) => r.name)
    .sort();
}

/** The tables the aggregate keeps its rows in: every product kind's, package_use, and the links its kinds start. */
export function extensionRecordTables(schema: SchemaDescription): string[] {
  const kinds = productKinds(schema).map((k) => k.name);
  return [...new Set([...kinds, 'package_use', ...kinds.flatMap((k) => startedRelations(schema, k))])];
}

/** The column naming the record's one parent: <parent kind>_id. */
export function parentColumn(kind: KindDescription): string {
  return kind.parents[0].column;
}

/** The columns a record of the kind takes as values: its title and its declared fields, not its ID or parent. */
export function valueColumns(schema: SchemaDescription, kind: KindDescription): string[] {
  return schema.tables[kind.name].columns.map((c) => c.name).filter((c) => c !== 'id' && c !== parentColumn(kind));
}

/** The extension records in the data, each whole; only the one given, when given. */
export function extensionRecordsFrom(schema: SchemaDescription, rows: (table: string) => Row[], only?: string): ExtensionRecord[] {
  const found: ExtensionRecord[] = [];
  const packages = rows('package_use');
  for (const kind of productKinds(schema)) {
    const own = rows(kind.name).filter((r) => only === undefined || r.id === only);
    if (!own.length) continue;
    const relations = startedRelations(schema, kind.name).map((name) => ({ name, rows: rows(name) }));
    for (const row of own) {
      const id = String(row.id);
      const links: Record<string, string[]> = {};
      for (const relation of relations) {
        const targets = relation.rows.filter((l) => l.source_id === id).map((l) => String(l.target_id)).sort();
        if (targets.length) links[relation.name] = targets;
      }
      found.push({ root: id, kind: kind.name, row, links, packages: packages.filter((p) => p.record_id === id).map((p) => String(p.package)).sort() });
    }
  }
  return found;
}

/** The record's rows, by table: its own row, its package uses, and the links it starts in each relation its kind may start. */
export function extensionRecordRows(schema: SchemaDescription, record: ExtensionRecord): Map<string, Row[]> {
  const rows = new Map<string, Row[]>([
    [record.kind, [record.row]],
    ['package_use', record.packages.map((name) => ({ record_id: record.root, package: name }))],
  ]);
  for (const relation of startedRelations(schema, record.kind)) {
    rows.set(relation, (record.links[relation] ?? []).map((target) => ({ source_id: record.root, target_id: target })));
  }
  return rows;
}

// Walks up the record's parents to the first record of the kind, or undefined.
function ancestor(view: ReadView, id: string, kind: string): string | undefined {
  const seen = new Set<string>();
  let at = view.record(id);
  while (at && !seen.has(String(at.row.id))) {
    if (at.kind === kind) return String(at.row.id);
    seen.add(String(at.row.id));
    const parent = view.schema.kinds[at.kind]?.parents.find((p) => at!.row[p.column] !== undefined && at!.row[p.column] !== null);
    if (!parent) return undefined;
    at = view.record(String(at.row[parent.column]));
  }
  return undefined;
}

/**
 * The product the record sits in: up its parents to a product, or, for a record of a kind with no owner on the way,
 * the longest product ID its ID starts with (and a hyphen). Null when there is none.
 */
export function productOf(view: ReadView, id: string): string | null {
  const up = ancestor(view, id, 'product');
  if (up) return up;
  const prefixes = view
    .rows('product')
    .map((p) => String(p.id))
    .filter((p) => id.startsWith(`${p}-`))
    .sort((a, b) => b.length - a.length);
  return prefixes[0] ?? null;
}

/** The domain the record sits in, up its parents, or undefined. */
export function domainOf(view: ReadView, id: string): string | undefined {
  return ancestor(view, id, 'domain');
}

/** What a command gives for a record's columns and links, checked against its kind's declaration. */
export interface Declared {
  values?: Record<string, unknown>;
  links?: Record<string, string[]>;
}

/**
 * Why the values or links are not the kind's, or null: a column the kind does not declare (field), or a relation its
 * kind may not start (relation). The column types and which are required are the table's to refuse.
 */
export function undeclared(schema: SchemaDescription, kind: KindDescription, given: Declared): { rule: string; message: string } | null {
  const columns = valueColumns(schema, kind);
  const unknown = Object.keys(given.values ?? {}).filter((c) => !columns.includes(c));
  if (unknown.length) {
    return { rule: 'field', message: `a ${kind.name} has no field ${unknown.join(', ')}; its fields are ${columns.join(', ')}, and its parent changes by no command` };
  }
  const relations = startedRelations(schema, kind.name);
  const foreign = Object.keys(given.links ?? {}).filter((r) => !relations.includes(r));
  if (foreign.length) {
    return { rule: 'relation', message: `a ${kind.name} starts no link of ${foreign.join(', ')}; ${relations.length ? `it starts ${relations.join(', ')}` : 'it starts no links'}` };
  }
  return null;
}

/** The record's row with the values applied: a value sets its column, null clears it. */
export function withValues(row: Row, values: Record<string, unknown> = {}): Row {
  const next: Row = { ...row };
  for (const [column, value] of Object.entries(values)) {
    if (value === null) delete next[column];
    else next[column] = value as Row[string];
  }
  return next;
}

/** The links with the given relations' lists replaced, each sorted and without repeats; an empty list clears it. */
export function withLinks(links: Record<string, string[]>, given: Record<string, string[]> = {}): Record<string, string[]> {
  const next = { ...links };
  for (const [relation, targets] of Object.entries(given)) {
    if (targets.length) next[relation] = [...new Set(targets)].sort();
    else delete next[relation];
  }
  return next;
}
