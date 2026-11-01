import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { PatternRepository } from '../repository.ts';
import { REMOVE_PATTERN_RULE_IDENTITY } from './identities.generated.ts';

/** The rule to remove. */
export type RemovePatternRule = { id: string };

export const REMOVE_PATTERN_RULE = {
  ...REMOVE_PATTERN_RULE_IDENTITY,
  input: {
    id: column('pattern_rule', 'id', 'required'),
  },
  handler: removePatternRule,
} satisfies CommandDefinition<RemovePatternRule>;

/** Removes the rule and its tests from its pattern. */
export function removePatternRule(tx: Transaction, input: RemovePatternRule): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('pattern_rule', input.id) ?? tx.refuse('missing', `there is no pattern rule ${input.id}`);
  pattern.rules = pattern.rules.filter((r) => r.id !== input.id);
  pattern.ruleTests = pattern.ruleTests.filter((t) => t.row.pattern_rule_id !== input.id);
  patterns.save(pattern);
}
