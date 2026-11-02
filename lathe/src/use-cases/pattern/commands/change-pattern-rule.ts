import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { PatternRuleRow } from '../../../platform/data/tables.ts';
import { CHANGE_PATTERN_RULE_IDENTITY } from './identities.generated.ts';
import { changePatternRule } from './handlers.generated.ts';

/** The rule's changes: a column given is set, null clears an optional one. */
export type ChangePatternRule = Pick<PatternRuleRow, 'id'> & { title?: PatternRuleRow['title']; statement?: PatternRuleRow['statement']; group_name?: PatternRuleRow['group_name'] | null; notes?: PatternRuleRow['notes'] | null };

export const CHANGE_PATTERN_RULE = {
  ...CHANGE_PATTERN_RULE_IDENTITY,
  input: {
    id: column('pattern_rule', 'id', 'required'),
    title: column('pattern_rule', 'title', 'optional'),
    statement: column('pattern_rule', 'statement', 'optional'),
    group_name: column('pattern_rule', 'group_name', 'clearable'),
    notes: column('pattern_rule', 'notes', 'clearable'),
  },
  handler: changePatternRule,
} satisfies CommandDefinition<ChangePatternRule>;
