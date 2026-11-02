// Generated from data/ by `npm run generate`. Do not edit.
// DataStoreRepository (LA-TEC-REPO23): Loads a data store whole (its row and the provided_by link it starts) from the
// transaction's draft and saves exactly the rows that changed, in its aggregate's own tables only; a removal is
// refused, naming them, while a repository, reader or table is stored in it.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { DATA_STORE_TABLES, dataStoreRows, dataStoresFrom, type DataStore } from './model.ts';

export class DataStoreRepository extends Repository<DataStore> {
  constructor(tx: Transaction) {
    super(tx, 'DataStoreRepository', DATA_STORE_TABLES);
  }

  protected read(rootId: string): DataStore | undefined {
    return dataStoresFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(dataStore: DataStore): InstanceRows {
    return dataStoreRows(dataStore);
  }
}
