// DataStoreRepository (LA-AUT-REPO23): loads and saves the Data store aggregate whole, in its own tables only.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { DATA_STORE_TABLES, dataStoreRows, dataStoresFrom, type DataStore } from './model.ts';

export class DataStoreRepository extends AggregateRepository<DataStore> {
  constructor(tx: Transaction) {
    super(tx, 'DataStoreRepository', DATA_STORE_TABLES);
  }

  protected read(rootId: string): DataStore | undefined {
    return dataStoresFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(store: DataStore): InstanceRows {
    return dataStoreRows(store);
  }
}
