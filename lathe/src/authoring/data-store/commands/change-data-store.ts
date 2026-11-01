import { column, id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DataStoreRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { DataStoreRepository } from '../repository.ts';
import { CHANGE_DATA_STORE_IDENTITY } from './identities.generated.ts';

/** The data store's changes: a column given is set; provided_by given sets the integration, null clears it. */
export type ChangeDataStore = Pick<DataStoreRow, 'id'> & { title?: DataStoreRow['title']; kind?: DataStoreRow['kind']; description?: DataStoreRow['description']; provided_by?: string | null };

export const CHANGE_DATA_STORE = {
  ...CHANGE_DATA_STORE_IDENTITY,
  input: {
    id: column('data_store', 'id', 'required'),
    title: column('data_store', 'title', 'optional'),
    kind: column('data_store', 'kind', 'optional'),
    description: column('data_store', 'description', 'optional'),
    provided_by: id('The integration that reaches it, when it is a service someone else runs that the user must provide.', 'clearable'),
  },
  handler: changeDataStore,
} satisfies CommandDefinition<ChangeDataStore>;

/** Changes the data store's columns and the integration that reaches it. */
export function changeDataStore(tx: Transaction, input: ChangeDataStore): void {
  const stores = new DataStoreRepository(tx);
  const store = stores.load(input.id) ?? tx.refuse('missing', `there is no data store ${input.id}`);
  store.store = changed(store.store, input, ['title', 'kind', 'description']);
  if (input.provided_by !== undefined) store.providedBy = input.provided_by;
  stores.save(store);
}
