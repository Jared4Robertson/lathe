// The Table aggregate's read model (LA-TEC-RM38), shaped for its readers: the Table page reads a table whole (what it
// stores, its keys in order, the standard rules it meets and the packages it uses), the list under an entity, a read
// model or a domain reads each table's ID and title, and the editor's next ID reads the IDs in use. The projection
// (tableTableFrom) is the only code that reads the source rows and the only code that writes the read model's table;
// the query handlers read that table only through the reader (reader.ts). Nothing here is the aggregate's own instance
// type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { TableKeyRow, TableRow } from '../../platform/data/tables.ts';
import { byRecordId } from '../../platform/data/ids.ts';

/** What a table sits under: the entity or read model it stores, or the domain whose own infrastructure it is. */
export interface TableParent {
  kind: 'entity' | 'read_model' | 'domain';
  id: string;
}

/** A table whole, as its page shows it. */
export interface TableTree {
  table: TableRow;
  /** What it sits under. */
  parent: TableParent;
  /** Its keys, in order. */
  keys: TableKeyRow[];
  /** The standard rules it meets and the packages it uses. */
  meets: string[];
  packages: string[];
}

/** A table as its page reads it, with the record the page is about: the table itself, its aggregate's one kind. */
export interface TablePage extends TableTree {
  record: { id: string; kind: 'table' };
}

/** A table as a list under its parent reads it. */
export interface TableSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface TableTable {
  /** Each table whole, by its ID. */
  tables: Map<string, TableTree>;
  /** The tables under each entity, read model or domain that has one, by ID. */
  under: Map<string, TableSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/** Rows by a column's value, each list in the table's order. */
function grouped<T>(rows: Row[], column: string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) found.set(String(r[column]), [...(found.get(String(r[column])) ?? []), r as unknown as T]);
  return found;
}

/** A link table's other ends by one column, each list sorted. */
function linked(rows: Row[], by: string, other: string): (id: string) => string[] {
  const found = grouped<Row>(rows, by);
  return (id) => (found.get(id) ?? []).map((l) => String(l[other])).sort();
}

/** The table's parent: the one of its parent columns it gives. */
function parentOf(table: TableRow): TableParent {
  if (table.entity_id !== undefined) return { kind: 'entity', id: table.entity_id };
  if (table.read_model_id !== undefined) return { kind: 'read_model', id: table.read_model_id };
  return { kind: 'domain', id: table.domain_id ?? '' };
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function tableTableFrom(view: ReadView): TableTable {
  const meets = linked(view.rows('meets'), 'source_id', 'target_id');
  const packages = linked(view.rows('package_use'), 'record_id', 'package');
  const keys = grouped<TableKeyRow>(view.rows('table_key'), 'table_id');
  const tables = new Map<string, TableTree>();
  const under = new Map<string, TableSummary[]>();
  for (const table of view.rows('table') as unknown as TableRow[]) {
    const parent = parentOf(table);
    tables.set(table.id, {
      table,
      parent,
      keys: [...(keys.get(table.id) ?? [])].sort((a, b) => a.position - b.position),
      meets: meets(table.id),
      packages: packages(table.id),
    });
    under.set(parent.id, [...(under.get(parent.id) ?? []), { id: table.id, title: table.title }]);
  }
  for (const list of under.values()) list.sort(byRecordId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { tables, under, kinds };
}
