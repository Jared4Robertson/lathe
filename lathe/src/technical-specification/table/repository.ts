// Generated from data/ by `npm run generate`. Do not edit.
// TableRepository (LA-TEC-REPO18): Loads a table whole (its keys, the standard rules it meets and the packages it uses)
// from the transaction's draft and saves exactly the rows that changed, in its aggregate's own tables only; a write to
// any other table is refused when it is made (`DataFiles`). A table is its own root, loaded by its ID, and a removal is
// refused, naming what references it, while anything left references it.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { TABLE_TABLES, tableRows, tablesFrom, type Table } from './model.ts';

export class TableRepository extends Repository<Table> {
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
