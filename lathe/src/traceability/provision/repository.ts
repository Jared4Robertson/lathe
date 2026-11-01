// Generated from data/ by `npm run generate`. Do not edit.
// ProvisionRepository (LA-TRC-REPO03): Loads a record's provision whole from the transaction's draft (its provided_by
// link) and saves exactly the rows that changed, in the provided_by table only.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { PROVISION_TABLES, provisionRows, provisionsFrom, type Provision } from './model.ts';

export class ProvisionRepository extends Repository<Provision> {
  constructor(tx: Transaction) {
    super(tx, 'ProvisionRepository', PROVISION_TABLES);
  }

  protected read(rootId: string): Provision | undefined {
    return provisionsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(provision: Provision): InstanceRows {
    return provisionRows(provision);
  }
}
