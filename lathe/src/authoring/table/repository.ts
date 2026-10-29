// TableRepository (LA-AUT-REPO18): loads and saves the Table aggregate whole, in its own tables only: a table with its
// keys, the standard rules it meets and the packages it uses.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { TABLE_TABLES, tableRows, tablesFrom, type Table } from './model.ts';

export class TableRepository extends AggregateRepository<Table> {
  constructor(tx: Transaction) {
    super(tx, 'TableRepository', TABLE_TABLES);
  }

  protected read(rootId: string): Table | undefined {
    return tablesFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(table: Table): InstanceRows {
    return tableRows(table);
  }
}
