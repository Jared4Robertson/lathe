import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { RuleRow } from '../../../platform/data/tables.ts';
import { CHANGE_RULE_IDENTITY } from './identities.generated.ts';
import { changeRule } from './handlers.generated.ts';

/** The rule's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeRule = Pick<RuleRow, 'id'> & { title?: string; file?: string | null; meets?: string[]; packages?: string[] };

export const CHANGE_RULE = {
  ...CHANGE_RULE_IDENTITY,
  input: {
    id: column('rule', 'id', 'required'),
    title: column('rule', 'title', 'optional'),
    file: column('rule', 'file', 'clearable'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
  },
  handler: changeRule,
} satisfies CommandDefinition<ChangeRule>;
