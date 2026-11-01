import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { BusinessOutcomeRepository } from '../repository.ts';
import { REMOVE_BUSINESS_OUTCOME_IDENTITY } from './identities.generated.ts';

/** The outcome to remove. */
export type RemoveBusinessOutcome = { id: string };

export const REMOVE_BUSINESS_OUTCOME = {
  ...REMOVE_BUSINESS_OUTCOME_IDENTITY,
  input: {
    id: column('business_outcome', 'id', 'required'),
  },
  handler: removeBusinessOutcome,
} satisfies CommandDefinition<RemoveBusinessOutcome>;

/** Removes the outcome whole. */
export function removeBusinessOutcome(tx: Transaction, input: RemoveBusinessOutcome): void {
  const outcomes = new BusinessOutcomeRepository(tx);
  const outcome = outcomes.load(input.id) ?? tx.refuse('missing', `there is no business outcome ${input.id}`);
  outcomes.remove(outcome);
}
