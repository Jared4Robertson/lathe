import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { AggregateRow } from '../../../platform/data/tables.ts';
import { newAggregate } from '../model.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_AGGREGATE_IDENTITY } from './identities.generated.ts';

/** A new aggregate: its row. */
export type AddAggregate = Pick<AggregateRow, 'id' | 'title' | 'domain_id' | 'description' | 'identity' | 'notes'>;

export const ADD_AGGREGATE = {
  ...ADD_AGGREGATE_IDENTITY,
  input: {
    id: column('aggregate', 'id', 'required'),
    title: column('aggregate', 'title', 'required'),
    domain_id: column('aggregate', 'domain_id', 'required'),
    description: column('aggregate', 'description', 'required'),
    identity: column('aggregate', 'identity', 'required'),
    notes: column('aggregate', 'notes', 'optional'),
  },
  handler: addAggregate,
} satisfies CommandDefinition<AddAggregate>;

/** Adds the aggregate, whole and new. */
export function addAggregate(tx: Transaction, input: AddAggregate): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.create(newAggregate(input));
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}
