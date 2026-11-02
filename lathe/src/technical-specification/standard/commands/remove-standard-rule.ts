import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_STANDARD_RULE_IDENTITY } from './identities.generated.ts';
import { removeStandardRule } from './handlers.generated.ts';

/** The rule to remove. */
export type RemoveStandardRule = { id: string };

export const REMOVE_STANDARD_RULE = {
  ...REMOVE_STANDARD_RULE_IDENTITY,
  input: {
    id: column('standard_rule', 'id', 'required'),
  },
  handler: removeStandardRule,
} satisfies CommandDefinition<RemoveStandardRule>;
