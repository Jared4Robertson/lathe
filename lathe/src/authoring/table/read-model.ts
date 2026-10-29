// The Table read model (LA-AUT-RM38): what the Table aggregate's queries answer with, shaped for their readers and
// built from rows by its projection. It shares no types with the aggregate's model.
import type { Row } from '../../platform/data/rows.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import type { TableKeyRow, TableRow } from '../../platform/data/tables.ts';

/** One table's page: its row, its keys in order, the standard rules it meets and the packages it uses. */
export interface TablePage {
  table: TableRow;
  keys: TableKeyRow[];
  meets: string[];
  packages: string[];
}

/** One line of a list of tables. */
export interface TableSummary {
  id: string;
  title: string;
}

// A link table's targets by source, each list sorted.
function bySource(links: Row[], source = 'source_id', target = 'target_id'): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const l of links) found.set(String(l[source]), [...(found.get(String(l[source])) ?? []), String(l[target])]);
  for (const list of found.values()) list.sort();
  return found;
}

/** The projection: each table's page, from the rows; only the one given, when given. */
export function tablePagesFrom(view: ReadView, only?: string): TablePage[] {
  const tables = (view.rows('table') as unknown as TableRow[]).filter((t) => only === undefined || t.id === only);
  if (!tables.length) return [];
  const meets = bySource(view.rows('meets'));
  const packages = bySource(view.rows('package_use'), 'record_id', 'package');
  const keys = view.rows('table_key') as unknown as TableKeyRow[];
  return tables.map((table) => ({
    table,
    keys: keys.filter((k) => k.table_id === table.id).sort((a, b) => a.position - b.position),
    meets: meets.get(table.id) ?? [],
    packages: packages.get(table.id) ?? [],
  }));
}
