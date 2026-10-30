// Remove a data store (LA-AUT-CMD372): Removes a data store with the link it starts. Refused while a repository, reader or table is stored in it, naming each.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DATA_STORE_SLICE } from '../model.ts';
import { DataStoreRepository } from '../repository.ts';

/** The data store to remove. */
export type RemoveDataStore = { id: string };

/** Remove a data store (LA-AUT-CMD372). */
export const REMOVE_DATA_STORE: CommandDefinition<RemoveDataStore> = {
  id: 'LA-AUT-CMD372',
  slice: DATA_STORE_SLICE,
  name: 'remove-data-store',
  description: 'Removes a data store with the link it starts. Refused while a repository, reader or table is stored in it, naming each.',
  method: 'POST',
  route: '/api/data-store/remove-data-store',
  input: {
    id: column('data_store', 'id', 'required'),
  },
  handler: removeDataStore,
};

/** Removes the data store whole. */
export function removeDataStore(tx: Transaction, input: RemoveDataStore): void {
  const stores = new DataStoreRepository(tx);
  const store = stores.load(input.id) ?? tx.refuse('missing', `there is no data store ${input.id}`);
  stores.remove(store);
}
