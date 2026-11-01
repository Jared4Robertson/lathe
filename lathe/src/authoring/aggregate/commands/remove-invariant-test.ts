import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { AggregateRepository } from '../repository.ts';
import { REMOVE_INVARIANT_TEST_IDENTITY } from './identities.generated.ts';

/** The test to remove. */
export type RemoveInvariantTest = { id: string };

export const REMOVE_INVARIANT_TEST = {
  ...REMOVE_INVARIANT_TEST_IDENTITY,
  input: {
    id: column('invariant_test', 'id', 'required'),
  },
  handler: removeInvariantTest,
} satisfies CommandDefinition<RemoveInvariantTest>;

/** Removes the test from its invariant. */
export function removeInvariantTest(tx: Transaction, input: RemoveInvariantTest): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('invariant_test', input.id) ?? tx.refuse('missing', `there is no invariant test ${input.id}`);
  aggregate.invariantTests = aggregate.invariantTests.filter((t) => t.row.id !== input.id);
  aggregates.save(aggregate);
}
