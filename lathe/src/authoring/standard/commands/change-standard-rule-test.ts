// Change a standard rule test (LA-AUT-CMD207): Changes a standard rule test's columns or the test data sets it starts from (the whole list).
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { StandardRuleTestRow } from '../../../platform/data/tables.ts';
import { STANDARD_SLICE, changed } from '../model.ts';
import { StandardRepository } from '../repository.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangeStandardRuleTest = Pick<StandardRuleTestRow, 'id'> & { title?: StandardRuleTestRow['title']; level?: StandardRuleTestRow['level']; state?: StandardRuleTestRow['state']; file?: StandardRuleTestRow['file'] | null; manual_reason?: StandardRuleTestRow['manual_reason'] | null; size?: StandardRuleTestRow['size'] | null; smoke?: StandardRuleTestRow['smoke'] | null; external?: StandardRuleTestRow['external'] | null; when?: StandardRuleTestRow['when']; then?: StandardRuleTestRow['then']; notes?: StandardRuleTestRow['notes'] | null; starts_from?: string[] };

/** Change a standard rule test (LA-AUT-CMD207). */
export const CHANGE_STANDARD_RULE_TEST: CommandDefinition<ChangeStandardRuleTest> = {
  id: 'LA-AUT-CMD207',
  slice: STANDARD_SLICE,
  name: 'change-standard-rule-test',
  description: "Changes a standard rule test's columns or the test data sets it starts from (the whole list).",
  method: 'POST',
  route: '/api/standard/change-standard-rule-test',
  input: {
    id: column('standard_rule_test', 'id', 'required'),
    title: column('standard_rule_test', 'title', 'optional'),
    level: column('standard_rule_test', 'level', 'optional'),
    state: column('standard_rule_test', 'state', 'optional'),
    file: column('standard_rule_test', 'file', 'clearable'),
    manual_reason: column('standard_rule_test', 'manual_reason', 'clearable'),
    size: column('standard_rule_test', 'size', 'clearable'),
    smoke: column('standard_rule_test', 'smoke', 'clearable'),
    external: column('standard_rule_test', 'external', 'clearable'),
    when: column('standard_rule_test', 'when', 'optional'),
    then: column('standard_rule_test', 'then', 'optional'),
    notes: column('standard_rule_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changeStandardRuleTest,
};

/** Changes the test's columns and the data sets it starts from. */
export function changeStandardRuleTest(tx: Transaction, input: ChangeStandardRuleTest): void {
  const standards = new StandardRepository(tx);
  const standard = standards.loadHolding('standard_rule_test', input.id) ?? tx.refuse('missing', `there is no standard rule test ${input.id}`);
  standard.ruleTests = standard.ruleTests.map((t) => (t.row.id === input.id ? { row: changed(t.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? t.startsFrom } : t));
  standards.save(standard);
}
