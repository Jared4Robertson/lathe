import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { StandardRuleTestRow } from '../../../platform/data/tables.ts';
import { CHANGE_STANDARD_RULE_TEST_IDENTITY } from './identities.generated.ts';
import { changeStandardRuleTest } from './handlers.generated.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangeStandardRuleTest = Pick<StandardRuleTestRow, 'id'> & { title?: StandardRuleTestRow['title']; level?: StandardRuleTestRow['level']; state?: StandardRuleTestRow['state']; file?: StandardRuleTestRow['file'] | null; manual_reason?: StandardRuleTestRow['manual_reason'] | null; size?: StandardRuleTestRow['size'] | null; smoke?: StandardRuleTestRow['smoke'] | null; external?: StandardRuleTestRow['external'] | null; when?: StandardRuleTestRow['when']; then?: StandardRuleTestRow['then']; notes?: StandardRuleTestRow['notes'] | null; starts_from?: string[] };

export const CHANGE_STANDARD_RULE_TEST = {
  ...CHANGE_STANDARD_RULE_TEST_IDENTITY,
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
} satisfies CommandDefinition<ChangeStandardRuleTest>;
