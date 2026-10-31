import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { AGGREGATE_SLICE } from '../model.ts';
import { AggregateRepository } from '../repository.ts';

/** The rule to remove. */
export type RemoveRule = { id: string };

export const REMOVE_RULE: CommandDefinition<RemoveRule> = {
  id: 'LA-AUT-CMD227',
  slice: AGGREGATE_SLICE,
  name: 'remove-rule',
  description: 'Removes a rule with the links it starts and the packages it uses, so its invariant is no longer built. Refused while anything else references it.',
  method: 'POST',
  route: '/api/aggregate/remove-rule',
  input: {
    id: column('rule', 'id', 'required'),
  },
  handler: removeRule,
};

/** Removes the rule from its invariant. */
export function removeRule(tx: Transaction, input: RemoveRule): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('rule', input.id) ?? tx.refuse('missing', `there is no rule ${input.id}`);
  aggregate.rules = aggregate.rules.filter((r) => r.row.id !== input.id);
  aggregates.save(aggregate);
}
