import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { StandardRuleTestRow } from '../../../platform/data/tables.ts';
import { StandardRepository } from '../repository.ts';
import { ADD_STANDARD_RULE_TEST_IDENTITY } from './identities.generated.ts';

export type AddStandardRuleTest = Pick<StandardRuleTestRow, 'id' | 'title' | 'standard_rule_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'when' | 'then' | 'notes'> & { starts_from?: string[] };

export const ADD_STANDARD_RULE_TEST = {
  ...ADD_STANDARD_RULE_TEST_IDENTITY,
  input: {
    id: column('standard_rule_test', 'id', 'required'),
    title: column('standard_rule_test', 'title', 'required'),
    standard_rule_id: column('standard_rule_test', 'standard_rule_id', 'required'),
    level: column('standard_rule_test', 'level', 'required'),
    state: column('standard_rule_test', 'state', 'required'),
    file: column('standard_rule_test', 'file', 'optional'),
    manual_reason: column('standard_rule_test', 'manual_reason', 'optional'),
    size: column('standard_rule_test', 'size', 'optional'),
    smoke: column('standard_rule_test', 'smoke', 'optional'),
    external: column('standard_rule_test', 'external', 'optional'),
    when: column('standard_rule_test', 'when', 'required'),
    then: column('standard_rule_test', 'then', 'required'),
    notes: column('standard_rule_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addStandardRuleTest,
} satisfies CommandDefinition<AddStandardRuleTest>;

export function addStandardRuleTest(tx: Transaction, input: AddStandardRuleTest): void {
  const standards = new StandardRepository(tx);
  const standard = standards.loadHolding('standard_rule', input.standard_rule_id) ?? tx.refuse('missing', `there is no standard rule ${input.standard_rule_id}`);
  const { starts_from = [], ...row } = input;
  standard.ruleTests.push({ row, startsFrom: starts_from });
  standards.save(standard);
}
