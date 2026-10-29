// Remove a pattern rule test (LA-AUT-CMD198): Removes a pattern rule test and the links it starts. Refused while anything references it.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { PATTERN_SLICE } from '../model.ts';
import { PatternRepository } from '../repository.ts';

/** The test to remove. */
export type RemovePatternRuleTest = { id: string };

/** Remove a pattern rule test (LA-AUT-CMD198). */
export const REMOVE_PATTERN_RULE_TEST: CommandDefinition<RemovePatternRuleTest> = {
  id: 'LA-AUT-CMD198',
  slice: PATTERN_SLICE,
  name: 'remove-pattern-rule-test',
  description: 'Removes a pattern rule test and the links it starts. Refused while anything references it.',
  method: 'POST',
  route: '/api/pattern/remove-pattern-rule-test',
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
