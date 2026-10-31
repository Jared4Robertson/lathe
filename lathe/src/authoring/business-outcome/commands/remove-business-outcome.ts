import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { BUSINESS_OUTCOME_SLICE } from '../model.ts';
import { BusinessOutcomeRepository } from '../repository.ts';

/** The outcome to remove. */
export type RemoveBusinessOutcome = { id: string };

export const REMOVE_BUSINESS_OUTCOME: CommandDefinition<RemoveBusinessOutcome> = {
  id: 'LA-AUT-CMD142',
  slice: BUSINESS_OUTCOME_SLICE,
  name: 'remove-business-outcome',
  description: 'Removes a business outcome with the measured_by links it starts. Refused while a capability serves it, or anything else references it.',
  method: 'POST',
  route: '/api/business-outcome/remove-business-outcome',
  input: {
    id: column('business_outcome', 'id', 'required'),
  },
  handler: removeBusinessOutcome,
};

/** Removes the outcome whole. */
export function removeBusinessOutcome(tx: Transaction, input: RemoveBusinessOutcome): void {
  const outcomes = new BusinessOutcomeRepository(tx);
  const outcome = outcomes.load(input.id) ?? tx.refuse('missing', `there is no business outcome ${input.id}`);
  outcomes.remove(outcome);
}
