// The Extension record read model (LA-AUT-RM39): what the Extension record aggregate's queries answer with, shaped for
// their readers (a record's page and a list of a parent's records of a kind) and built from rows by its projection,
// with each record's shape read from its kind's declaration. It shares no types with the aggregate's model.
import type { Value } from '../../platform/data/rows.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import type { KindDescription } from '../../platform/data/schema.ts';
import { domainOf, parentColumn, placeIn, productKinds, productOf, startedRelations, type Place } from './declaration.ts';

/** One record of a product's own kind, as its page shows it. */
export interface ExtensionRecordPage {
  id: string;
  /** Its kind: a product kind's name, which is also its table's. */
  kind: string;
  /** Its kind's name as people read it, such as Report. */
  label: string;
  /** The record it sits under, of its kind's parent kind. */
  parent: string;
  /** Its title and its declared fields' values, by column, in the table's order; a field it does not give is left out. */
  values: Record<string, Value>;
  /** The records it links to, by relation: only relations its kind may start, each list sorted. */
  links: Record<string, string[]>;
  /** The packages it uses, sorted. */
  packages: string[];
}

/** One line of a list of records of a product kind. */
export interface ExtensionRecordSummary {
  id: string;
  title: string;
}

// Each extension record's page, from the rows.
function extensionRecordPagesFrom(view: ReadView): ExtensionRecordPage[] {
  const pages: ExtensionRecordPage[] = [];
  const packages = view.rows('package_use');
  for (const kind of productKinds(view.schema)) {
    const own = view.rows(kind.name);
    const parent = parentColumn(kind);
    const columns = view.schema.tables[kind.name].columns.map((c) => c.name).filter((c) => c !== 'id' && c !== parent);
    const relations = startedRelations(view.schema, kind.name).map((name) => ({ name, rows: view.rows(name) }));
    for (const row of own) {
      const id = String(row.id);
      const links: Record<string, string[]> = {};
      for (const relation of relations) {
        const targets = relation.rows.filter((l) => l.source_id === id).map((l) => String(l.target_id)).sort();
        if (targets.length) links[relation.name] = targets;
      }
      const values: Record<string, Value> = {};
      for (const column of columns) if (row[column] !== undefined && row[column] !== null) values[column] = row[column];
      pages.push({
        id,
        kind: kind.name,
        label: kind.label,
        parent: String(row[parent]),
        values,
        links,
        packages: packages.filter((p) => p.record_id === id).map((p) => String(p.package)).sort(),
      });
    }
  }
  return pages;
}

/** The read model's table: each record's page, each parent's records by kind, the declared kinds, and where every record sits. */
export interface ExtensionRecordTable {
  pages: Map<string, ExtensionRecordPage>;
  /** The records of each product kind under each parent, by ID, keyed by the kind and the parent. */
  lists: Map<string, ExtensionRecordSummary[]>;
  /** The kinds the products declare, by name. */
  productKinds: KindDescription[];
  /** Every record ID in use, with its kind and the record it sits under. */
  places: Map<string, Place>;
  /** Every product's ID. */
  products: string[];
}

/** The key of a parent's records of a kind in the table's lists. */
export const listKey = (kind: string, parent: string) => `${kind} ${parent}`;

/**
 * The projection: the read model's table, built from the rows on each read. It is the only code that reads the source
 * rows for the queries.
 */
export function extensionRecordTableFrom(view: ReadView): ExtensionRecordTable {
  const pages = new Map<string, ExtensionRecordPage>();
  const lists = new Map<string, ExtensionRecordSummary[]>();
  for (const page of extensionRecordPagesFrom(view)) {
    pages.set(page.id, page);
    const key = listKey(page.kind, page.parent);
    lists.set(key, [...(lists.get(key) ?? []), { id: page.id, title: String(page.values.title) }]);
  }
  for (const list of lists.values()) list.sort((a, b) => a.id.localeCompare(b.id));
  const place = placeIn(view);
  const places = new Map<string, Place>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) places.set(String(row.id), place(String(row.id))!);
  return { pages, lists, productKinds: productKinds(view.schema), places, products: view.rows('product').map((p) => String(p.id)) };
}

/** The product a record sits in, from the table's places. */
export const productIn = (table: ExtensionRecordTable, id: string) => productOf((at) => table.places.get(at), table.products, id);

/** The domain a record sits in, from the table's places. */
export const domainIn = (table: ExtensionRecordTable, id: string) => domainOf((at) => table.places.get(at), id);
