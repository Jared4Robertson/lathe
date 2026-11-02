import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { RuleRow } from '../../../platform/data/tables.ts';
import { ADD_RULE_IDENTITY } from './identities.generated.ts';
import { addRule } from './handlers.generated.ts';

export type AddRule = Pick<RuleRow, 'id' | 'title' | 'invariant_id' | 'file'> & { meets?: string[]; packages?: string[] };

export const ADD_RULE = {
  ...ADD_RULE_IDENTITY,
  input: {
    id: column('rule', 'id', 'required'),
    title: column('rule', 'title', 'required'),
    invariant_id: column('rule', 'invariant_id', 'required'),
    file: column('rule', 'file', 'optional'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts('The packages it uses, each listed in one of the product\'s package.json files.', 'optional'),
  },
  handler: addRule,
} satisfies CommandDefinition<AddRule>;
