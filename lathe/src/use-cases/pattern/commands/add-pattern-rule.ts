import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { PatternRuleRow } from '../../../platform/data/tables.ts';
import { ADD_PATTERN_RULE_IDENTITY } from './identities.generated.ts';
import { addPatternRule } from './handlers.generated.ts';

/** A new pattern rule. */
export type AddPatternRule = Pick<PatternRuleRow, 'id' | 'title' | 'pattern_id' | 'statement' | 'group_name' | 'notes'>;

export const ADD_PATTERN_RULE = {
  ...ADD_PATTERN_RULE_IDENTITY,
  input: {
    id: column('pattern_rule', 'id', 'required'),
    title: column('pattern_rule', 'title', 'required'),
    pattern_id: column('pattern_rule', 'pattern_id', 'required'),
    statement: column('pattern_rule', 'statement', 'required'),
    group_name: column('pattern_rule', 'group_name', 'optional'),
    notes: column('pattern_rule', 'notes', 'optional'),
  },
  handler: addPatternRule,
} satisfies CommandDefinition<AddPatternRule>;
