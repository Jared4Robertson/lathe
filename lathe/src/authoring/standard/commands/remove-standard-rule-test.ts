import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { STANDARD_SLICE } from '../model.ts';
import { StandardRepository } from '../repository.ts';

/** The test to remove. */
export type RemoveStandardRuleTest = { id: string };

export const REMOVE_STANDARD_RULE_TEST: CommandDefinition<RemoveStandardRuleTest> = {
  id: 'LA-AUT-CMD208',
  slice: STANDARD_SLICE,
  name: 'remove-standard-rule-test',
  description: 'Removes a standard rule test and the links it starts. Refused while anything references it.',
  method: 'POST',
  route: '/api/standard/remove-standard-rule-test',
  input: {
    id: column('standard_rule_test', 'id', 'required'),
  },
  handler: removeStandardRuleTest,
};

/** Removes the test from its standard rule. */
export function removeStandardRuleTest(tx: Transaction, input: RemoveStandardRuleTest): void {
  const standards = new StandardRepository(tx);
  const standard = standards.loadHolding('standard_rule_test', input.id) ?? tx.refuse('missing', `there is no standard rule test ${input.id}`);
  standard.ruleTests = standard.ruleTests.filter((t) => t.row.id !== input.id);
  standards.save(standard);
}
