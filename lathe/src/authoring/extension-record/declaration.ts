// The Extension record aggregate's declarations (LA-AUT-A19): what a product kind's declaration says a record of it is,
// read from the schema the declaration builds: the kinds the products declare, the relations a kind may start, its
// parent column and value columns, and where a record sits (its product and domain, up its parents). The model, the
// commands and the read model read a record's shape here, so none of them holds it in code.
import type { ReadView } from '../../platform/data/rules.ts';
import type { KindDescription, SchemaDescription } from '../../platform/data/schema.ts';

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

/** The column naming the record's one parent: <parent kind>_id. */
export function parentColumn(kind: KindDescription): string {
  return kind.parents[0].column;
}

/** The columns a record of the kind takes as values: its title and its declared fields, not its ID or parent. */
export function valueColumns(schema: SchemaDescription, kind: KindDescription): string[] {
  return schema.tables[kind.name].columns.map((c) => c.name).filter((c) => c !== 'id' && c !== parentColumn(kind));
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
