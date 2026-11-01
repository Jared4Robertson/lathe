import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { PatternRepository } from '../repository.ts';
import { REMOVE_PATTERN_RULE_TEST_IDENTITY } from './identities.generated.ts';

/** The test to remove. */
export type RemovePatternRuleTest = { id: string };

export const REMOVE_PATTERN_RULE_TEST: CommandDefinition<RemovePatternRuleTest> = {
  ...REMOVE_PATTERN_RULE_TEST_IDENTITY,
  input: {
    id: column('pattern_rule_test', 'id', 'required'),
  },
  handler: removePatternRuleTest,
};

/** Removes the test from its pattern rule. */
export function removePatternRuleTest(tx: Transaction, input: RemovePatternRuleTest): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('pattern_rule_test', input.id) ?? tx.refuse('missing', `there is no pattern rule test ${input.id}`);
  pattern.ruleTests = pattern.ruleTests.filter((t) => t.row.id !== input.id);
  patterns.save(pattern);
}
