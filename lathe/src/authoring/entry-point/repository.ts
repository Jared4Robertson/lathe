// EntryPointRepository (LA-AUT-REPO20): loads and saves the Entry point aggregate whole, in its own tables only: the
// entry point, the packages it uses and the standard rules it meets.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { entryPointRows, entryPointsFrom, ENTRY_POINT_TABLES, type EntryPoint } from './model.ts';

export class EntryPointRepository extends AggregateRepository<EntryPoint> {
  constructor(tx: Transaction) {
    super(tx, 'EntryPointRepository', ENTRY_POINT_TABLES);
  }

  protected read(rootId: string): EntryPoint | undefined {
    return entryPointsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(record: EntryPoint): InstanceRows {
    return entryPointRows(record);
  }
}
