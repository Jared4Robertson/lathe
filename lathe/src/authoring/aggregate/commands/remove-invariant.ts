import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { AGGREGATE_SLICE } from '../model.ts';
import { AggregateRepository } from '../repository.ts';

/** The invariant to remove. */
export type RemoveInvariant = { id: string };

export const REMOVE_INVARIANT: CommandDefinition<RemoveInvariant> = {
  id: 'LA-AUT-CMD218',
  slice: AGGREGATE_SLICE,
  name: 'remove-invariant',
  description: 'Removes an invariant with its rule and its test, and the links they start. Refused while anything else references them, such as a table key it names.',
  method: 'POST',
  route: '/api/aggregate/remove-invariant',
  input: {
    id: column('invariant', 'id', 'required'),
  },
  handler: removeInvariant,
};

/** Removes the invariant, its rule and its test from its aggregate. */
export function removeInvariant(tx: Transaction, input: RemoveInvariant): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('invariant', input.id) ?? tx.refuse('missing', `there is no invariant ${input.id}`);
  aggregate.invariants = aggregate.invariants.filter((i) => i.id !== input.id);
  aggregate.rules = aggregate.rules.filter((r) => r.row.invariant_id !== input.id);
  aggregate.invariantTests = aggregate.invariantTests.filter((t) => t.row.invariant_id !== input.id);
  aggregates.save(aggregate);
}
