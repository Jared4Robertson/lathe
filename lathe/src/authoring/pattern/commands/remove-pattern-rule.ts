import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { PATTERN_SLICE } from '../model.ts';
import { PatternRepository } from '../repository.ts';

/** The rule to remove. */
export type RemovePatternRule = { id: string };

export const REMOVE_PATTERN_RULE: CommandDefinition<RemovePatternRule> = {
  id: 'LA-AUT-CMD195',
  slice: PATTERN_SLICE,
  name: 'remove-pattern-rule',
  description: 'Removes a pattern rule with its tests and the links they start. Refused while anything references it or them.',
  method: 'POST',
  route: '/api/pattern/remove-pattern-rule',
  input: {
    id: column('pattern_rule', 'id', 'required'),
  },
  handler: removePatternRule,
};

/** Removes the rule and its tests from its pattern. */
export function removePatternRule(tx: Transaction, input: RemovePatternRule): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('pattern_rule', input.id) ?? tx.refuse('missing', `there is no pattern rule ${input.id}`);
  pattern.rules = pattern.rules.filter((r) => r.id !== input.id);
  pattern.ruleTests = pattern.ruleTests.filter((t) => t.row.pattern_rule_id !== input.id);
  patterns.save(pattern);
}
