import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { BusinessOutcomeRow } from '../../../platform/data/tables.ts';
import { BUSINESS_OUTCOME_SLICE, changed } from '../model.ts';
import { BusinessOutcomeRepository } from '../repository.ts';

/** The outcome's changes: a column given is set, null clears an optional one; measured_by, when given, replaces the list. */
export type ChangeBusinessOutcome = Pick<BusinessOutcomeRow, 'id'> & {
  title?: string;
  statement?: string;
  measure?: string;
  target?: string;
  measured_outside?: string | null;
  notes?: string | null;
  measured_by?: string[];
};

export const CHANGE_BUSINESS_OUTCOME: CommandDefinition<ChangeBusinessOutcome> = {
  id: 'LA-AUT-CMD141',
  slice: BUSINESS_OUTCOME_SLICE,
  name: 'change-business-outcome',
  description: "Changes a business outcome's title, statement, measure, target, how it is measured outside the code or notes, or what measures it (the whole list). Its product stays.",
  method: 'POST',
  route: '/api/business-outcome/change-business-outcome',
  input: {
    id: column('business_outcome', 'id', 'required'),
    title: column('business_outcome', 'title', 'optional'),
    statement: column('business_outcome', 'statement', 'optional'),
    measure: column('business_outcome', 'measure', 'optional'),
    target: column('business_outcome', 'target', 'optional'),
    measured_outside: column('business_outcome', 'measured_outside', 'clearable'),
    notes: column('business_outcome', 'notes', 'clearable'),
    measured_by: ids('The tests, or records of the product\'s own kinds, that measure it. Replaces the list.', 'optional'),
  },
  handler: changeBusinessOutcome,
};

/** Changes the outcome's own columns and what measures it. */
export function changeBusinessOutcome(tx: Transaction, input: ChangeBusinessOutcome): void {
  const outcomes = new BusinessOutcomeRepository(tx);
  const outcome = outcomes.load(input.id) ?? tx.refuse('missing', `there is no business outcome ${input.id}`);
  outcome.outcome = changed(outcome.outcome, input, ['title', 'statement', 'measure', 'target', 'measured_outside', 'notes']);
  if (input.measured_by) outcome.measuredBy = [...input.measured_by].sort();
  outcomes.save(outcome);
}
