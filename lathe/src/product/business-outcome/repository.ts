// Generated from data/ by `npm run generate`. Do not edit.
// BusinessOutcomeRepository (LA-PRD-REPO16): Loads a business outcome whole (its row and the measured_by links it
// starts) and saves exactly the rows that changed, in its own tables only; a removal is refused, naming the referrers,
// while a capability serves it or anything else references it.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { BUSINESS_OUTCOME_TABLES, businessOutcomeRows, businessOutcomesFrom, type BusinessOutcome } from './model.ts';

export class BusinessOutcomeRepository extends Repository<BusinessOutcome> {
  constructor(tx: Transaction) {
    super(tx, 'BusinessOutcomeRepository', BUSINESS_OUTCOME_TABLES);
  }

  protected read(rootId: string): BusinessOutcome | undefined {
    return businessOutcomesFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(businessOutcome: BusinessOutcome): InstanceRows {
    return businessOutcomeRows(businessOutcome);
  }
}
