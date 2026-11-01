import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { StandardRuleRow } from '../../../platform/data/tables.ts';
import { ADD_STANDARD_RULE_IDENTITY } from './identities.generated.ts';
import { addStandardRule } from './handlers.generated.ts';

/** A new standard rule. */
export type AddStandardRule = Pick<StandardRuleRow, 'id' | 'title' | 'standard_id' | 'statement' | 'group_name'>;

export const ADD_STANDARD_RULE = {
  ...ADD_STANDARD_RULE_IDENTITY,
  input: {
    id: column('standard_rule', 'id', 'required'),
    title: column('standard_rule', 'title', 'required'),
    standard_id: column('standard_rule', 'standard_id', 'required'),
    statement: column('standard_rule', 'statement', 'required'),
    group_name: column('standard_rule', 'group_name', 'optional'),
  },
  handler: addStandardRule,
} satisfies CommandDefinition<AddStandardRule>;
