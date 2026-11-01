import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { AggregateRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_AGGREGATE_IDENTITY } from './identities.generated.ts';

/** The aggregate's changes: a column given is set, null clears an optional one. */
export type ChangeAggregate = Pick<AggregateRow, 'id'> & { title?: string; description?: string; identity?: string; notes?: string | null };

export const CHANGE_AGGREGATE: CommandDefinition<ChangeAggregate> = {
  ...CHANGE_AGGREGATE_IDENTITY,
  input: {
    id: column('aggregate', 'id', 'required'),
    title: column('aggregate', 'title', 'optional'),
    description: column('aggregate', 'description', 'optional'),
    identity: column('aggregate', 'identity', 'optional'),
    notes: column('aggregate', 'notes', 'clearable'),
  },
  handler: changeAggregate,
};

/** Changes the aggregate's own columns. */
export function changeAggregate(tx: Transaction, input: ChangeAggregate): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.load(input.id) ?? tx.refuse('missing', `there is no aggregate ${input.id}`);
  aggregate.aggregate = changed(aggregate.aggregate, input, ['title', 'description', 'identity', 'notes']);
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}
