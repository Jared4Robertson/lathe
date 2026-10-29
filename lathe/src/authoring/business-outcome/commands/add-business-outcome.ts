// Add a business outcome (LA-AUT-CMD140): Adds a business outcome under its product, with the tests and records that measure it.
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { BusinessOutcomeRow } from '../../../platform/data/tables.ts';
import { BUSINESS_OUTCOME_SLICE } from '../model.ts';
import { BusinessOutcomeRepository } from '../repository.ts';

/** A new business outcome, with the tests and records that measure it. */
export type AddBusinessOutcome = Pick<BusinessOutcomeRow, 'id' | 'title' | 'product_id' | 'statement' | 'measure' | 'target' | 'measured_outside' | 'notes'> & { measured_by?: string[] };

/** Add a business outcome (LA-AUT-CMD140). */
export const ADD_BUSINESS_OUTCOME: CommandDefinition<AddBusinessOutcome> = {
  id: 'LA-AUT-CMD140',
  slice: BUSINESS_OUTCOME_SLICE,
  name: 'add-business-outcome',
  description: 'Adds a business outcome under its product, with the tests and records that measure it.',
  method: 'POST',
  route: '/api/business-outcome/add-business-outcome',
  input: {
    id: column('business_outcome', 'id', 'required'),
    title: column('business_outcome', 'title', 'required'),
    product_id: column('business_outcome', 'product_id', 'required'),
    statement: column('business_outcome', 'statement', 'required'),
    measure: column('business_outcome', 'measure', 'required'),
    target: column('business_outcome', 'target', 'required'),
    measured_outside: column('business_outcome', 'measured_outside', 'optional'),
    notes: column('business_outcome', 'notes', 'optional'),
    measured_by: ids('The tests, or records of the product\'s own kinds, that measure it.', 'optional'),
  },
  handler: addBusinessOutcome,
};

/** Adds the outcome, whole and new. */
export function addBusinessOutcome(tx: Transaction, input: AddBusinessOutcome): void {
  const outcomes = new BusinessOutcomeRepository(tx);
  if (tx.record(input.id)) tx.refuse('primary-key', `business_outcome ${input.id} already exists`);
  if (tx.record(input.product_id)?.kind !== 'product') tx.refuse('missing', `there is no product ${input.product_id}`);
  const { measured_by = [], ...row } = input;
  const outcome = outcomes.create({ root: row.id, outcome: row, measuredBy: [...measured_by].sort() });
  outcomes.save(outcome);
}
