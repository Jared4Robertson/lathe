// BusinessOutcomeRepository (LA-AUT-REPO16): loads and saves the Business outcome aggregate whole, in its own tables
// only: the outcome and the measured_by links it starts.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { BUSINESS_OUTCOME_TABLES, businessOutcomeRows, businessOutcomesFrom, type BusinessOutcome } from './model.ts';

export class BusinessOutcomeRepository extends AggregateRepository<BusinessOutcome> {
  constructor(tx: Transaction) {
    super(tx, 'BusinessOutcomeRepository', BUSINESS_OUTCOME_TABLES);
  }

  protected read(rootId: string): BusinessOutcome | undefined {
    return businessOutcomesFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(outcome: BusinessOutcome): InstanceRows {
    return businessOutcomeRows(outcome);
  }
}
