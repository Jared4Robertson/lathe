import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { toDomain } from '../../../platform/data/renames.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DataStoreRepository } from '../repository.ts';
import { MOVE_DATA_STORE_IDENTITY } from './identities.generated.ts';

/** The data store and the domain it moves to. */
export interface MoveDataStore {
  id: string;
  domain_id: string;
}

export const MOVE_DATA_STORE = {
  ...MOVE_DATA_STORE_IDENTITY,
  input: {
    id: column('data_store', 'id', 'required'),
    domain_id: column('data_store', 'domain_id', 'required'),
  },
  handler: moveDataStore,
} satisfies CommandDefinition<MoveDataStore>;

export function moveDataStore(tx: Transaction, input: MoveDataStore): void {
  const stores = new DataStoreRepository(tx);
  const store = stores.load(input.id) ?? tx.refuse('missing', `there is no data store ${input.id}`);
  const from = store.store.domain_id ?? tx.refuse('parent', `${input.id} is a data store of product ${String(store.store.product_id)}, used by several of its domains: it has no domain to move from`);
  const renames = toDomain(tx, { id: input.id, label: 'data store', domainId: from }, input.domain_id);
  store.store = { ...store.store, domain_id: input.domain_id };
  stores.save(store);
  stores.carryRenames(renames);
}
