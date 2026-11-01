// ProvisionRepository (LA-TRC-REPO03): loads and saves the Provision aggregate whole (a record's provided_by link) in
// its own table only.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { PROVISION_TABLES, provisionRows, provisionsFrom, type Provision } from './model.ts';

export class ProvisionRepository extends AggregateRepository<Provision> {
  constructor(tx: Transaction) {
    super(tx, 'ProvisionRepository', PROVISION_TABLES);
  }

  protected read(root: string): Provision | undefined {
    return provisionsFrom((table) => this.files.rows(table), root)[0];
  }

  protected rowsOf(provision: Provision): InstanceRows {
    return provisionRows(provision);
  }
}
