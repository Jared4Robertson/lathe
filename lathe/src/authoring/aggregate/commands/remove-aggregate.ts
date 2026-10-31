import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { AGGREGATE_SLICE } from '../model.ts';
import { AggregateRepository } from '../repository.ts';

/** The aggregate to remove. */
export type RemoveAggregate = { id: string };

export const REMOVE_AGGREGATE: CommandDefinition<RemoveAggregate> = {
  id: 'LA-AUT-CMD212',
  slice: AGGREGATE_SLICE,
  name: 'remove-aggregate',
  description: 'Removes an aggregate whole: its entities and their fields, data models, invariants with their rules, tests and the links they start. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/aggregate/remove-aggregate',
  input: {
    id: column('aggregate', 'id', 'required'),
  },
  handler: removeAggregate,
};

/** Removes the aggregate whole. */
export function removeAggregate(tx: Transaction, input: RemoveAggregate): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.load(input.id) ?? tx.refuse('missing', `there is no aggregate ${input.id}`);
  aggregates.remove(aggregate);
}
