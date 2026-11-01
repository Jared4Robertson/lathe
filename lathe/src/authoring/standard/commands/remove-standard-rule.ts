import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { StandardRepository } from '../repository.ts';
import { REMOVE_STANDARD_RULE_IDENTITY } from './identities.generated.ts';

/** The rule to remove. */
export type RemoveStandardRule = { id: string };

export const REMOVE_STANDARD_RULE: CommandDefinition<RemoveStandardRule> = {
  ...REMOVE_STANDARD_RULE_IDENTITY,
  input: {
    id: column('standard_rule', 'id', 'required'),
  },
  handler: removeStandardRule,
};

/** Removes the rule and its tests from its standard. */
export function removeStandardRule(tx: Transaction, input: RemoveStandardRule): void {
  const standards = new StandardRepository(tx);
  const standard = standards.loadHolding('standard_rule', input.id) ?? tx.refuse('missing', `there is no standard rule ${input.id}`);
  standard.rules = standard.rules.filter((r) => r.id !== input.id);
  standard.ruleTests = standard.ruleTests.filter((t) => t.row.standard_rule_id !== input.id);
  standards.save(standard);
}
