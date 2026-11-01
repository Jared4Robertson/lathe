import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_PATTERN_RULE_TEST_IDENTITY } from './identities.generated.ts';
import { removePatternRuleTest } from './handlers.generated.ts';

/** The test to remove. */
export type RemovePatternRuleTest = { id: string };

export const REMOVE_PATTERN_RULE_TEST = {
  ...REMOVE_PATTERN_RULE_TEST_IDENTITY,
  input: {
    id: column('pattern_rule_test', 'id', 'required'),
  },
  handler: removePatternRuleTest,
} satisfies CommandDefinition<RemovePatternRuleTest>;
