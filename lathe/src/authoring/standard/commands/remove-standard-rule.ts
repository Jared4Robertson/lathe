import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { STANDARD_SLICE } from '../model.ts';
import { StandardRepository } from '../repository.ts';

/** The rule to remove. */
export type RemoveStandardRule = { id: string };

export const REMOVE_STANDARD_RULE: CommandDefinition<RemoveStandardRule> = {
  id: 'LA-AUT-CMD205',
  slice: STANDARD_SLICE,
  name: 'remove-standard-rule',
  description: 'Removes a standard rule with its tests and the links they start. Refused while a technical record meets it or anything else references it or its tests.',
  method: 'POST',
  route: '/api/standard/remove-standard-rule',
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
