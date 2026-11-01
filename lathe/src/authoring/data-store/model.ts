// The Data store aggregate (LA-AUT-A23): where data actually lives (a database, a bucket, a folder of files, browser
// storage, memory), under its product or one of its domains. The repositories, readers and tables stored in it name it
// themselves (stored_in, which their own aggregates start), and the integration that reaches it when it is a service
// someone else runs is its provider (provided_by, which the Provision aggregate holds). One instance is one data store,
// whole: its row.
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
}

/** The tables the Data store aggregate keeps its rows in: its kind. */
export const DATA_STORE_TABLES = ['data_store'] as const;

/** A new data store. */
export function newDataStore(store: DataStoreRow): DataStore {
  return { root: store.id, store };
}

/** The data stores in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function dataStoresFrom(rows: (table: string) => Row[], only?: string): DataStore[] {
  const stores = rows('data_store').filter((r) => only === undefined || r.id === only) as unknown as DataStoreRow[];
  return stores.map((store) => ({ root: store.id, store }));
}

/** The instance's rows, by table. */
export function dataStoreRows(store: DataStore): Map<string, Row[]> {
  return new Map<string, Row[]>([
    ['data_store', [store.store as unknown as Row]],
  ]);
}
