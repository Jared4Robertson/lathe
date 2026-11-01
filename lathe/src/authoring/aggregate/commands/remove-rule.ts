import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { AggregateRepository } from '../repository.ts';
import { REMOVE_RULE_IDENTITY } from './identities.generated.ts';

/** The rule to remove. */
export type RemoveRule = { id: string };

export const REMOVE_RULE = {
  ...REMOVE_RULE_IDENTITY,
  input: {
    id: column('rule', 'id', 'required'),
  },
  handler: removeRule,
} satisfies CommandDefinition<RemoveRule>;

/** Removes the rule from its invariant. */
export function removeRule(tx: Transaction, input: RemoveRule): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('rule', input.id) ?? tx.refuse('missing', `there is no rule ${input.id}`);
  aggregate.rules = aggregate.rules.filter((r) => r.row.id !== input.id);
  aggregates.save(aggregate);
}
