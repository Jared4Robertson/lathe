import { column, id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DataStoreRow } from '../../../platform/data/tables.ts';
import { DATA_STORE_SLICE, newDataStore } from '../model.ts';
import { DataStoreRepository } from '../repository.ts';

export type AddDataStore = Pick<DataStoreRow, 'id' | 'title' | 'product_id' | 'domain_id' | 'kind' | 'description'> & { provided_by?: string };

export const ADD_DATA_STORE: CommandDefinition<AddDataStore> = {
  id: 'LA-AUT-CMD370',
  slice: DATA_STORE_SLICE,
  name: 'add-data-store',
  description: 'Adds a data store under its product or one of its domains (exactly one of product_id and domain_id), with the integration that reaches it when it is a service someone else runs.',
  method: 'POST',
  route: '/api/data-store/add-data-store',
  input: {
    id: column('data_store', 'id', 'required'),
    title: column('data_store', 'title', 'required'),
    product_id: column('data_store', 'product_id', 'optional'),
    domain_id: column('data_store', 'domain_id', 'optional'),
    kind: column('data_store', 'kind', 'required'),
    description: column('data_store', 'description', 'required'),
    provided_by: id('The integration that reaches it, when it is a service someone else runs that the user must provide.', 'optional'),
  },
  handler: addDataStore,
};

export function addDataStore(tx: Transaction, input: AddDataStore): void {
  const stores = new DataStoreRepository(tx);
  if ((input.product_id === undefined) === (input.domain_id === undefined)) {
    tx.refuse('parent', `data store ${input.id} sits under its product or one of its domains: give exactly one of product_id and domain_id`);
  }
  const { provided_by, ...row } = input;
  const store = stores.create(newDataStore(row, provided_by ?? null));
  stores.save(store);
}
