import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { StandardRepository } from '../repository.ts';
import { REMOVE_STANDARD_RULE_TEST_IDENTITY } from './identities.generated.ts';

/** The test to remove. */
export type RemoveStandardRuleTest = { id: string };

export const REMOVE_STANDARD_RULE_TEST = {
  ...REMOVE_STANDARD_RULE_TEST_IDENTITY,
  input: {
    id: column('standard_rule_test', 'id', 'required'),
  },
  handler: removeStandardRuleTest,
} satisfies CommandDefinition<RemoveStandardRuleTest>;

/** Removes the test from its standard rule. */
export function removeStandardRuleTest(tx: Transaction, input: RemoveStandardRuleTest): void {
  const standards = new StandardRepository(tx);
  const standard = standards.loadHolding('standard_rule_test', input.id) ?? tx.refuse('missing', `there is no standard rule test ${input.id}`);
  standard.ruleTests = standard.ruleTests.filter((t) => t.row.id !== input.id);
  standards.save(standard);
}
