import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { AggregateRepository } from '../repository.ts';
import { REMOVE_AGGREGATE_IDENTITY } from './identities.generated.ts';

/** The aggregate to remove. */
export type RemoveAggregate = { id: string };

export const REMOVE_AGGREGATE: CommandDefinition<RemoveAggregate> = {
  ...REMOVE_AGGREGATE_IDENTITY,
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
