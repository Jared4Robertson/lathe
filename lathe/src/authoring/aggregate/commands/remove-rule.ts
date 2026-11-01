import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_RULE_IDENTITY } from './identities.generated.ts';
import { removeRule } from './handlers.generated.ts';

/** The rule to remove. */
export type RemoveRule = { id: string };

export const REMOVE_RULE = {
  ...REMOVE_RULE_IDENTITY,
  input: {
    id: column('rule', 'id', 'required'),
  },
  handler: removeRule,
} satisfies CommandDefinition<RemoveRule>;
