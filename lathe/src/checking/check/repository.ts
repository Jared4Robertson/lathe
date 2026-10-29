// CheckRepository (LA-CHK-REPO01): loads and saves the Check aggregate, one check row by its name, in the check table
// only. Lathe's own rows load with the rest and never change: a save that touches one is refused as built-in.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { CHECK_TABLES, checkRows, checksFrom, type Check } from './model.ts';

export class CheckRepository extends AggregateRepository<Check> {
  constructor(tx: Transaction) {
    super(tx, 'CheckRepository', CHECK_TABLES);
  }

  protected read(name: string): Check | undefined {
    return checksFrom((table) => this.files.rows(table), name)[0];
  }

  protected rowsOf(check: Check): InstanceRows {
    return checkRows(check);
  }

  /** Whether the check is one of Lathe's own, loaded from lathe/data/check.jsonl and so read-only. */
  isLathes(check: Check): boolean {
    return this.tx.isBuiltIn(this.files.find('check', { name: check.root })!);
  }
}
