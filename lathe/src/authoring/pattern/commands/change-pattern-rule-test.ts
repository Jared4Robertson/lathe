import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { PatternRuleTestRow } from '../../../platform/data/tables.ts';
import { CHANGE_PATTERN_RULE_TEST_IDENTITY } from './identities.generated.ts';
import { changePatternRuleTest } from './handlers.generated.ts';

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
