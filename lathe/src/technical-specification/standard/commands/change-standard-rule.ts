import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { StandardRuleRow } from '../../../platform/data/tables.ts';
import { CHANGE_STANDARD_RULE_IDENTITY } from './identities.generated.ts';
import { changeStandardRule } from './handlers.generated.ts';

/** The rule's changes: a column given is set, null clears an optional one. */
export type ChangeStandardRule = Pick<StandardRuleRow, 'id'> & { title?: StandardRuleRow['title']; statement?: StandardRuleRow['statement']; group_name?: StandardRuleRow['group_name'] | null };

export const CHANGE_STANDARD_RULE = {
  ...CHANGE_STANDARD_RULE_IDENTITY,
  input: {
    id: column('standard_rule', 'id', 'required'),
    title: column('standard_rule', 'title', 'optional'),
    statement: column('standard_rule', 'statement', 'optional'),
    group_name: column('standard_rule', 'group_name', 'clearable'),
  },
  handler: changeStandardRule,
} satisfies CommandDefinition<ChangeStandardRule>;
