import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_PATTERN_RULE_IDENTITY } from './identities.generated.ts';
import { removePatternRule } from './handlers.generated.ts';

/** The rule to remove. */
export type RemovePatternRule = { id: string };

export const REMOVE_PATTERN_RULE = {
  ...REMOVE_PATTERN_RULE_IDENTITY,
  input: {
    id: column('pattern_rule', 'id', 'required'),
  },
  handler: removePatternRule,
} satisfies CommandDefinition<RemovePatternRule>;
