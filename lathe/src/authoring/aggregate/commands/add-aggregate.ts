import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { AggregateRow } from '../../../platform/data/tables.ts';
import { AGGREGATE_SLICE, newAggregate } from '../model.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new aggregate: its row. */
export type AddAggregate = Pick<AggregateRow, 'id' | 'title' | 'domain_id' | 'description' | 'identity' | 'notes'>;

export const ADD_AGGREGATE: CommandDefinition<AddAggregate> = {
  id: 'LA-AUT-CMD210',
  slice: AGGREGATE_SLICE,
  name: 'add-aggregate',
  description: 'Adds an aggregate under a domain, with nothing in it yet.',
  method: 'POST',
  route: '/api/aggregate/add-aggregate',
  input: {
    id: column('aggregate', 'id', 'required'),
    title: column('aggregate', 'title', 'required'),
    domain_id: column('aggregate', 'domain_id', 'required'),
    description: column('aggregate', 'description', 'required'),
    identity: column('aggregate', 'identity', 'required'),
    notes: column('aggregate', 'notes', 'optional'),
  },
  handler: addAggregate,
};

/** Adds the aggregate, whole and new. */
export function addAggregate(tx: Transaction, input: AddAggregate): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.create(newAggregate(input));
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}
