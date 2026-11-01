import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { PatternRuleTestRow } from '../../../platform/data/tables.ts';
import { ADD_PATTERN_RULE_TEST_IDENTITY } from './identities.generated.ts';
import { addPatternRuleTest } from './handlers.generated.ts';

export type AddPatternRuleTest = Pick<PatternRuleTestRow, 'id' | 'title' | 'pattern_rule_id' | 'domain_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'when' | 'then' | 'notes'> & { starts_from?: string[] };

export const ADD_PATTERN_RULE_TEST = {
  ...ADD_PATTERN_RULE_TEST_IDENTITY,
  input: {
    id: column('pattern_rule_test', 'id', 'required'),
    title: column('pattern_rule_test', 'title', 'required'),
    pattern_rule_id: column('pattern_rule_test', 'pattern_rule_id', 'required'),
    domain_id: column('pattern_rule_test', 'domain_id', 'required'),
    level: column('pattern_rule_test', 'level', 'required'),
    state: column('pattern_rule_test', 'state', 'required'),
    file: column('pattern_rule_test', 'file', 'optional'),
    manual_reason: column('pattern_rule_test', 'manual_reason', 'optional'),
    size: column('pattern_rule_test', 'size', 'optional'),
    smoke: column('pattern_rule_test', 'smoke', 'optional'),
    external: column('pattern_rule_test', 'external', 'optional'),
    when: column('pattern_rule_test', 'when', 'required'),
    then: column('pattern_rule_test', 'then', 'required'),
    notes: column('pattern_rule_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addPatternRuleTest,
} satisfies CommandDefinition<AddPatternRuleTest>;
