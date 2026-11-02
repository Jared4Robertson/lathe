// Generated from data/ by `npm run generate`. Do not edit.
// The data-store commands whose handler is the pattern: load the data store, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DataStoreRepository } from '../repository.ts';
import type { ChangeDataStore } from './change-data-store.ts';
import type { RemoveDataStore } from './remove-data-store.ts';

/** Changes a data store's title, kind or description. Its product or domain never changes: remove it and add it again under another. */
export function changeDataStore(tx: Transaction, input: ChangeDataStore): void {
  const dataStores = new DataStoreRepository(tx);
  const dataStore = dataStores.load(input.id) ?? tx.refuse('missing', `there is no data store ${input.id}`);
  dataStore.store = changed(dataStore.store, input, ['title', 'kind', 'description']);
  dataStores.save(dataStore);
}

/** Removes a data store whole. Refused while a repository, reader or table is stored in it, or something provides it, naming each. */
export function removeDataStore(tx: Transaction, input: RemoveDataStore): void {
  const dataStores = new DataStoreRepository(tx);
  const dataStore = dataStores.load(input.id) ?? tx.refuse('missing', `there is no data store ${input.id}`);
  dataStores.remove(dataStore);
}
