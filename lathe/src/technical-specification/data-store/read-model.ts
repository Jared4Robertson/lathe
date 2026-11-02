// The Data store aggregate's read model (LA-TEC-RM43), shaped for its readers: the Data store page reads a data store
// whole (the product or domain it sits under, the integration that reaches it, and the repositories, readers and tables
// stored in it), a product's or domain's list reads each store's ID, title and kind, and the editor's next ID reads the
// IDs in use. The projection (dataStoreTableFrom) is the only code that reads the source rows and the only code that
// writes the read model's table; the query handlers read that table only through the reader (reader.ts). Nothing here
// is the aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { DataStoreRow } from '../../platform/data/tables.ts';
import { byRecordId } from '../../platform/data/ids.ts';

/** A record a data store page names: its ID, kind and title. */
export interface NamedRecord {
  id: string;
  kind: string;
  title: string;
}

/** A data store whole, as its page shows it. */
export interface DataStorePage {
  store: DataStoreRow;
  /** The product or domain it sits under. */
  parent: NamedRecord;
  /** The integration that reaches it, when someone else runs it. */
  providedBy: NamedRecord | null;
  /** The repositories, readers and tables stored in it, by ID. */
  stores: NamedRecord[];
}

/** A data store as a product's or domain's list reads it. */
export interface DataStoreSummary {
  id: string;
  title: string;
  kind: DataStoreRow['kind'];
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface DataStoreTable {
  /** Each data store whole, by its ID. */
  pages: Map<string, DataStorePage>;
  /** Each product's data stores (its own and its domains') and each domain's, by ID; one with none has an empty list. */
  parents: Map<string, DataStoreSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function dataStoreTableFrom(view: ReadView): DataStoreTable {
  const named = new Map<string, NamedRecord>();
  for (const kind of ['product', 'domain', 'integration', 'repository', 'reader', 'table']) {
    for (const r of view.rows(kind)) named.set(String(r.id), { id: String(r.id), kind, title: String(r.title) });
  }
  const providedBy = new Map(view.rows('provided_by').map((l) => [String(l.source_id), String(l.target_id)]));
  const storedHere = new Map<string, NamedRecord[]>();
  for (const l of view.rows('stored_in')) {
    const record = named.get(String(l.source_id));
    if (record) storedHere.set(String(l.target_id), [...(storedHere.get(String(l.target_id)) ?? []), record]);
  }
  const productOf = new Map(view.rows('domain').map((d) => [String(d.id), String(d.product_id)]));
  const pages = new Map<string, DataStorePage>();
  const parents = new Map<string, DataStoreSummary[]>();
  for (const kind of ['product', 'domain']) for (const r of view.rows(kind)) parents.set(String(r.id), []);
  for (const store of view.rows('data_store') as unknown as DataStoreRow[]) {
    const parentId = store.product_id ?? store.domain_id!;
    const provider = providedBy.get(store.id);
    pages.set(store.id, {
      store,
      parent: named.get(parentId) ?? { id: parentId, kind: store.product_id ? 'product' : 'domain', title: parentId },
      providedBy: provider === undefined ? null : (named.get(provider) ?? { id: provider, kind: 'integration', title: provider }),
      stores: (storedHere.get(store.id) ?? []).sort(byRecordId),
    });
    const summary = { id: store.id, title: store.title, kind: store.kind };
    parents.get(parentId)?.push(summary);
    if (store.domain_id) parents.get(productOf.get(store.domain_id) ?? '')?.push(summary);
  }
  for (const list of parents.values()) list.sort(byRecordId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { pages, parents, kinds };
}
