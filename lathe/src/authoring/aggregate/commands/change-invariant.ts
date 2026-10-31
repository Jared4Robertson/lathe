import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { InvariantRow } from '../../../platform/data/tables.ts';
import { AGGREGATE_SLICE, changed } from '../model.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The invariant's changes: a column given is set. */
export type ChangeInvariant = Pick<InvariantRow, 'id'> & { title?: string; statement?: string };

export const CHANGE_INVARIANT: CommandDefinition<ChangeInvariant> = {
  id: 'LA-AUT-CMD217',
  slice: AGGREGATE_SLICE,
  name: 'change-invariant',
  description: "Changes an invariant's title or statement. Its aggregate does not change.",
  method: 'POST',
  route: '/api/aggregate/change-invariant',
  input: {
    id: column('invariant', 'id', 'required'),
    title: column('invariant', 'title', 'optional'),
    statement: column('invariant', 'statement', 'optional'),
  },
  handler: changeInvariant,
};

/** Changes the invariant's columns. */
export function changeInvariant(tx: Transaction, input: ChangeInvariant): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('invariant', input.id) ?? tx.refuse('missing', `there is no invariant ${input.id}`);
  aggregate.invariants = aggregate.invariants.map((i) => (i.id === input.id ? changed(i, input, ['title', 'statement']) : i));
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}
