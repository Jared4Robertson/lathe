// The Data store aggregate (LA-AUT-A23): where data actually lives (a database, a bucket, a folder of files, browser
// storage, memory), under its product or one of its domains, with the integration that reaches it when it is a service
// someone else runs. The repositories, readers and tables stored in it name it themselves (stored_in, which their own
// aggregates start). One instance is one data store, whole; it holds only the link its own record starts.
import type { Row, Value } from '../../platform/data/rows.ts';
import type { DataStoreRow } from '../../platform/data/tables.ts';

/**
 * The row with the changes applied: a value sets its column, null clears it, and a column left out keeps its value.
 * Only the columns named in `columns` are taken from the changes.
 */
export function changed<R extends object>(row: R, changes: object, columns: readonly string[]): R {
  const next = { ...row } as Record<string, unknown>;
  for (const [column, value] of Object.entries(changes)) {
    if (!columns.includes(column) || value === undefined) continue;
    if (value === null) delete next[column];
    else next[column] = value as Value;
  }
  return next as R;
}

/** One data store, whole. */
export interface DataStore {
  /** The data store's ID: the aggregate's root. */
  readonly root: string;
  store: DataStoreRow;
  /** The integration that reaches it, when someone else runs it: one at most. */
  providedBy: string | null;
}

/** The tables the Data store aggregate keeps its rows in: its kind and the relation its record starts. */
export const DATA_STORE_TABLES = ['data_store', 'provided_by'] as const;

/** A new data store, with the integration that reaches it, if any. */
export function newDataStore(store: DataStoreRow, providedBy: string | null): DataStore {
  return { root: store.id, store, providedBy };
}

/** The data stores in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function dataStoresFrom(rows: (table: string) => Row[], only?: string): DataStore[] {
  const stores = rows('data_store').filter((r) => only === undefined || r.id === only) as unknown as DataStoreRow[];
  if (!stores.length) return [];
  const providedBy = new Map(rows('provided_by').map((l) => [String(l.source_id), String(l.target_id)]));
  return stores.map((store) => ({ root: store.id, store, providedBy: providedBy.get(store.id) ?? null }));
}

/** The instance's rows, by table. */
export function dataStoreRows(store: DataStore): Map<string, Row[]> {
  return new Map<string, Row[]>([
    ['data_store', [store.store as unknown as Row]],
    ['provided_by', store.providedBy ? [{ source_id: store.root, target_id: store.providedBy }] : []],
  ]);
}
