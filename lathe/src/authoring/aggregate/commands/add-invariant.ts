import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { InvariantRow } from '../../../platform/data/tables.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_INVARIANT_IDENTITY } from './identities.generated.ts';

/** A new invariant. */
export type AddInvariant = Pick<InvariantRow, 'id' | 'title' | 'aggregate_id' | 'statement'>;

export const ADD_INVARIANT: CommandDefinition<AddInvariant> = {
  ...ADD_INVARIANT_IDENTITY,
  input: {
    id: column('invariant', 'id', 'required'),
    title: column('invariant', 'title', 'required'),
    aggregate_id: column('invariant', 'aggregate_id', 'required'),
    statement: column('invariant', 'statement', 'required'),
  },
  handler: addInvariant,
};

/** Adds the invariant to its aggregate. */
export function addInvariant(tx: Transaction, input: AddInvariant): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('aggregate', input.aggregate_id) ?? tx.refuse('missing', `there is no aggregate ${input.aggregate_id}`);
  aggregate.invariants.push(input);
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}
