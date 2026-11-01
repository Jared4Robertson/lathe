// Generated from data/ by `npm run generate`. Do not edit.
// ToolingRepository (LA-AUT-REPO21): Loads a tooling record whole (its row, the package_use rows naming it and the
// meets links it starts) and saves exactly the rows that changed, in its own tables only, and only its own record's
// rows of the shared package_use and meets tables.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { TOOLING_TABLES, toolingRows, toolingsFrom, type Tooling } from './model.ts';

export class ToolingRepository extends Repository<Tooling> {
  constructor(tx: Transaction) {
    super(tx, 'ToolingRepository', TOOLING_TABLES);
  }

  protected read(rootId: string): Tooling | undefined {
    return toolingsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(tooling: Tooling): InstanceRows {
    return toolingRows(tooling);
  }
}
