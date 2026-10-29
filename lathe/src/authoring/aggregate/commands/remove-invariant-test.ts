// Remove an invariant test (LA-AUT-CMD224): Removes an invariant test with the links it starts. Refused while anything else references it, such as a business outcome it measures.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { AGGREGATE_SLICE } from '../model.ts';
import { AggregateRepository } from '../repository.ts';

/** The test to remove. */
export type RemoveInvariantTest = { id: string };

/** Remove an invariant test (LA-AUT-CMD224). */
export const REMOVE_INVARIANT_TEST: CommandDefinition<RemoveInvariantTest> = {
  id: 'LA-AUT-CMD224',
  slice: AGGREGATE_SLICE,
  name: 'remove-invariant-test',
  description: 'Removes an invariant test with the links it starts. Refused while anything else references it, such as a business outcome it measures.',
  method: 'POST',
  route: '/api/aggregate/remove-invariant-test',
  input: {
    id: column('invariant_test', 'id', 'required'),
  },
  handler: removeInvariantTest,
};

/** Removes the test from its invariant. */
export function removeInvariantTest(tx: Transaction, input: RemoveInvariantTest): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('invariant_test', input.id) ?? tx.refuse('missing', `there is no invariant test ${input.id}`);
  aggregate.invariantTests = aggregate.invariantTests.filter((t) => t.row.id !== input.id);
  aggregates.save(aggregate);
}
