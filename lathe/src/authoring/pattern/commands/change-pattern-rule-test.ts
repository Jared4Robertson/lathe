// Change a pattern rule test (LA-AUT-CMD197): Changes a pattern rule test's columns, the domain it proves the rule in, or the test data sets it starts from (the whole list).
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PatternRuleTestRow } from '../../../platform/data/tables.ts';
import { PATTERN_SLICE, changed } from '../model.ts';
import { PatternRepository } from '../repository.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangePatternRuleTest = Pick<PatternRuleTestRow, 'id'> & { title?: PatternRuleTestRow['title']; domain_id?: PatternRuleTestRow['domain_id']; level?: PatternRuleTestRow['level']; state?: PatternRuleTestRow['state']; file?: PatternRuleTestRow['file'] | null; manual_reason?: PatternRuleTestRow['manual_reason'] | null; size?: PatternRuleTestRow['size'] | null; smoke?: PatternRuleTestRow['smoke'] | null; external?: PatternRuleTestRow['external'] | null; when?: PatternRuleTestRow['when']; then?: PatternRuleTestRow['then']; notes?: PatternRuleTestRow['notes'] | null; starts_from?: string[] };

/** Change a pattern rule test (LA-AUT-CMD197). */
export const CHANGE_PATTERN_RULE_TEST: CommandDefinition<ChangePatternRuleTest> = {
  id: 'LA-AUT-CMD197',
  slice: PATTERN_SLICE,
  name: 'change-pattern-rule-test',
  description: "Changes a pattern rule test's columns, the domain it proves the rule in, or the test data sets it starts from (the whole list).",
  method: 'POST',
  route: '/api/pattern/change-pattern-rule-test',
  input: {
    id: column('pattern_rule_test', 'id', 'required'),
    title: column('pattern_rule_test', 'title', 'optional'),
    domain_id: column('pattern_rule_test', 'domain_id', 'optional'),
    level: column('pattern_rule_test', 'level', 'optional'),
    state: column('pattern_rule_test', 'state', 'optional'),
    file: column('pattern_rule_test', 'file', 'clearable'),
    manual_reason: column('pattern_rule_test', 'manual_reason', 'clearable'),
    size: column('pattern_rule_test', 'size', 'clearable'),
    smoke: column('pattern_rule_test', 'smoke', 'clearable'),
    external: column('pattern_rule_test', 'external', 'clearable'),
    when: column('pattern_rule_test', 'when', 'optional'),
    then: column('pattern_rule_test', 'then', 'optional'),
    notes: column('pattern_rule_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changePatternRuleTest,
};

/** Changes the test's columns and the data sets it starts from. */
export function changePatternRuleTest(tx: Transaction, input: ChangePatternRuleTest): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('pattern_rule_test', input.id) ?? tx.refuse('missing', `there is no pattern rule test ${input.id}`);
  pattern.ruleTests = pattern.ruleTests.map((t) => (t.row.id === input.id ? { row: changed(t.row, input, ['title', 'domain_id', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? t.startsFrom } : t));
  patterns.save(pattern);
}
