import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PatternRuleTestRow } from '../../../platform/data/tables.ts';
import { changed } from '../../../platform/data/rows.ts';
import { PatternRepository } from '../repository.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import { patternRuleTestPerDomain } from '../rules.ts';
import { CHANGE_PATTERN_RULE_TEST_IDENTITY } from './identities.generated.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangePatternRuleTest = Pick<PatternRuleTestRow, 'id'> & { title?: PatternRuleTestRow['title']; domain_id?: PatternRuleTestRow['domain_id']; level?: PatternRuleTestRow['level']; state?: PatternRuleTestRow['state']; file?: PatternRuleTestRow['file'] | null; manual_reason?: PatternRuleTestRow['manual_reason'] | null; size?: PatternRuleTestRow['size'] | null; smoke?: PatternRuleTestRow['smoke'] | null; external?: PatternRuleTestRow['external'] | null; when?: PatternRuleTestRow['when']; then?: PatternRuleTestRow['then']; notes?: PatternRuleTestRow['notes'] | null; starts_from?: string[] };

export const CHANGE_PATTERN_RULE_TEST = {
  ...CHANGE_PATTERN_RULE_TEST_IDENTITY,
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
} satisfies CommandDefinition<ChangePatternRuleTest>;

/** Changes the test's columns and the data sets it starts from. */
export function changePatternRuleTest(tx: Transaction, input: ChangePatternRuleTest): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('pattern_rule_test', input.id) ?? tx.refuse('missing', `there is no pattern rule test ${input.id}`);
  pattern.ruleTests = pattern.ruleTests.map((t) => (t.row.id === input.id ? { row: changed(t.row, input, ['title', 'domain_id', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? t.startsFrom } : t));
  refuseBroken(patternRuleTestPerDomain(pattern.ruleTests.map((t) => t.row)));
  patterns.save(pattern);
}
