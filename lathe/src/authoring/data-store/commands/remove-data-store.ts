import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DataStoreRepository } from '../repository.ts';
import { REMOVE_DATA_STORE_IDENTITY } from './identities.generated.ts';

/** The data store to remove. */
export type RemoveDataStore = { id: string };

export const REMOVE_DATA_STORE: CommandDefinition<RemoveDataStore> = {
  ...REMOVE_DATA_STORE_IDENTITY,
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
