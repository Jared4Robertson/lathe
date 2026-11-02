// Generated from data/ by `npm run generate`. Do not edit.
// The business-outcome commands whose handler is the pattern: load the business outcome, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { BusinessOutcomeRepository } from '../repository.ts';
import type { ChangeBusinessOutcome } from './change-business-outcome.ts';
import type { RemoveBusinessOutcome } from './remove-business-outcome.ts';

/** Changes a business outcome's title, statement, measure, target, how it is measured outside the code or notes, or what measures it (the whole list). Its product stays. */
export function changeBusinessOutcome(tx: Transaction, input: ChangeBusinessOutcome): void {
  const businessOutcomes = new BusinessOutcomeRepository(tx);
  const businessOutcome = businessOutcomes.load(input.id) ?? tx.refuse('missing', `there is no business outcome ${input.id}`);
  businessOutcome.outcome = changed(businessOutcome.outcome, input, ['title', 'statement', 'measure', 'target', 'measured_outside', 'notes']);
  businessOutcome.measuredBy = input.measured_by ?? businessOutcome.measuredBy;
  businessOutcomes.save(businessOutcome);
}

/** Removes a business outcome with the measured_by links it starts. Refused while a capability serves it, or anything else references it. */
export function removeBusinessOutcome(tx: Transaction, input: RemoveBusinessOutcome): void {
  const businessOutcomes = new BusinessOutcomeRepository(tx);
  const businessOutcome = businessOutcomes.load(input.id) ?? tx.refuse('missing', `there is no business outcome ${input.id}`);
  businessOutcomes.remove(businessOutcome);
}
