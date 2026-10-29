// ToolingRepository (LA-AUT-REPO21): loads and saves the Tooling aggregate whole, in its own tables only: the
// tooling record, the packages it uses and the standard rules it meets.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { toolingRows, toolingsFrom, TOOLING_TABLES, type Tooling } from './model.ts';

export class ToolingRepository extends AggregateRepository<Tooling> {
  constructor(tx: Transaction) {
    super(tx, 'ToolingRepository', TOOLING_TABLES);
  }

  protected read(rootId: string): Tooling | undefined {
    return toolingsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(record: Tooling): InstanceRows {
    return toolingRows(record);
  }
}
