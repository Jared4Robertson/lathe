// Generated from data/ by `npm run generate`. Do not edit.
// EntryPointRepository (LA-AUT-REPO20): Loads an entry point whole (its row, the package_use rows naming it and the
// meets links it starts) and saves exactly the rows that changed, in its own tables only, and only its own record's
// rows of the shared package_use and meets tables.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { ENTRY_POINT_TABLES, entryPointRows, entryPointsFrom, type EntryPoint } from './model.ts';

export class EntryPointRepository extends Repository<EntryPoint> {
  constructor(tx: Transaction) {
    super(tx, 'EntryPointRepository', ENTRY_POINT_TABLES);
  }

  protected read(rootId: string): EntryPoint | undefined {
    return entryPointsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(entryPoint: EntryPoint): InstanceRows {
    return entryPointRows(entryPoint);
  }
}
