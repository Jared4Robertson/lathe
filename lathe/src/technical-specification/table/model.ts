// The Table aggregate (LA-TEC-A18): where an entity's or read model's rows, or a domain's own infrastructure such as a
// link table or an outbox, are stored, with its keys in order, the data store it is kept in, the standard rules it
// meets and the packages it uses.
// One instance is one table, whole; it holds only the links its own record starts.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { TableKeyRow, TableRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const TABLE_AGGREGATE = 'LA-TEC-A18';

/** The columns of a key a command gives: its table and its position follow from the list it is in. */
export const KEY_COLUMNS = ['type', 'columns', 'name', 'invariant_id', 'target_table_id', 'condition'] as const;

/** One key of a table. Its position is its place in the table's list. */
export type TableKey = Omit<TableKeyRow, 'table_id' | 'position'>;

/** The columns that name a table's parent: exactly one is given. */
export const PARENT_COLUMNS = ['entity_id', 'read_model_id', 'domain_id'] as const;

/** One table, whole. */
export interface Table {
  /** The table's ID: the aggregate's root. */
  readonly root: string;
  table: TableRow;
  /** Its keys, in order. */
  keys: TableKey[];
  /** The data store it is kept in, once named: one at most. */
  storedIn: string | null;
  meets: string[];
  packages: string[];
}

/** The tables the Table aggregate keeps its rows in: its kind, its part, and the relation and part its record starts. */
export const TABLE_TABLES = ['table', 'table_key', 'stored_in', 'meets', 'package_use'] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const TABLE_SHAPE = {
  table: { at: 'table', lists: { meets: 'meets', packages: 'packages' }, given: { keys: 'keys' }, links: { stored_in: 'storedIn' } },
} as const satisfies AggregateShape;

/** The tables in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function tablesFrom(rows: (table: string) => Row[], only?: string): Table[] {
  const tables = rows('table').filter((r) => only === undefined || r.id === only) as unknown as TableRow[];
  if (!tables.length) return [];
  const ids = new Set(tables.map((t) => t.id));
  const keysOf = groupBy((rows('table_key') as unknown as TableKeyRow[]).filter((k) => ids.has(k.table_id)), (k) => k.table_id);
  const storedIn = bySource(rows('stored_in'));
  const meets = bySource(rows('meets'));
  const packages = bySource(rows('package_use'), 'record_id', 'package');
  return tables.map((table) => ({
    root: table.id,
    table,
    keys: [...groupOf(keysOf, table.id)]
      .sort((a, b) => a.position - b.position)
      .map(({ table_id: _owner, position: _at, ...key }) => key),
    storedIn: groupOf(storedIn, table.id)[0] ?? null,
    meets: groupOf(meets, table.id),
    packages: groupOf(packages, table.id),
  }));
}

/** The instance's rows, by table. */
export function tableRows(table: Table): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  return new Map<string, Row[]>([
    ['table', [asRow(table.table)]],
    ['table_key', table.keys.map((k, at) => asRow({ table_id: table.root, position: at + 1, ...k }))],
    ['stored_in', table.storedIn ? [{ source_id: table.root, target_id: table.storedIn }] : []],
    ['meets', table.meets.map((target) => ({ source_id: table.root, target_id: target }))],
    ['package_use', table.packages.map((name) => ({ record_id: table.root, package: name }))],
  ]);
}
