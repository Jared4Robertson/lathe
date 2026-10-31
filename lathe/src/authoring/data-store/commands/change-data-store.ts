import { column, id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DataStoreRow } from '../../../platform/data/tables.ts';
import { DATA_STORE_SLICE, changed } from '../model.ts';
import { DataStoreRepository } from '../repository.ts';

/** The data store's changes: a column given is set; provided_by given sets the integration, null clears it. */
export type ChangeDataStore = Pick<DataStoreRow, 'id'> & { title?: DataStoreRow['title']; kind?: DataStoreRow['kind']; description?: DataStoreRow['description']; provided_by?: string | null };

export const CHANGE_DATA_STORE: CommandDefinition<ChangeDataStore> = {
  id: 'LA-AUT-CMD371',
  slice: DATA_STORE_SLICE,
  name: 'change-data-store',
  description: "Changes a data store's title, kind or description, or the integration that reaches it (null clears it). Its product or domain never changes: remove it and add it again under another.",
  method: 'POST',
  route: '/api/data-store/change-data-store',
  input: {
    id: column('data_store', 'id', 'required'),
    title: column('data_store', 'title', 'optional'),
    kind: column('data_store', 'kind', 'optional'),
    description: column('data_store', 'description', 'optional'),
    provided_by: id('The integration that reaches it, when it is a service someone else runs that the user must provide.', 'clearable'),
  },
  handler: changeDataStore,
};

/** Changes the data store's columns and the integration that reaches it. */
export function changeDataStore(tx: Transaction, input: ChangeDataStore): void {
  const stores = new DataStoreRepository(tx);
  const store = stores.load(input.id) ?? tx.refuse('missing', `there is no data store ${input.id}`);
  store.store = changed(store.store, input, ['title', 'kind', 'description']);
  if (input.provided_by !== undefined) store.providedBy = input.provided_by;
  stores.save(store);
}
