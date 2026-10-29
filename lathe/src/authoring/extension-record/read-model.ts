// The Extension record read model (LA-AUT-RM39): what the Extension record aggregate's queries answer with, shaped for
// their readers (a record's page and a list of a parent's records of a kind) and built from rows by its projection,
// with each record's shape read from its kind's declaration. It shares no types with the aggregate's model.
import type { Value } from '../../platform/data/rows.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { parentColumn, productKinds, startedRelations } from './declaration.ts';

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

/** The projection: each extension record's page, from the rows; only the one given, when given. */
export function extensionRecordPagesFrom(view: ReadView, only?: string): ExtensionRecordPage[] {
  const pages: ExtensionRecordPage[] = [];
  const packages = view.rows('package_use');
  for (const kind of productKinds(view.schema)) {
    const own = view.rows(kind.name).filter((r) => only === undefined || r.id === only);
    if (!own.length) continue;
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

/** The projection's list: the records of a product kind under one parent, by ID. */
export function extensionRecordSummariesFrom(view: ReadView, kind: string, parent: string): ExtensionRecordSummary[] {
  const declared = view.schema.kinds[kind];
  const column = parentColumn(declared);
  return view
    .rows(kind)
    .filter((r) => r[column] === parent)
    .map((r) => ({ id: String(r.id), title: String(r.title) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
