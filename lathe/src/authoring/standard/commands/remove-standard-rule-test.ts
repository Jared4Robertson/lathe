import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_STANDARD_RULE_TEST_IDENTITY } from './identities.generated.ts';
import { removeStandardRuleTest } from './handlers.generated.ts';

/** The test to remove. */
export type RemoveStandardRuleTest = { id: string };

export const REMOVE_STANDARD_RULE_TEST = {
  ...REMOVE_STANDARD_RULE_TEST_IDENTITY,
  input: {
    id: column('standard_rule_test', 'id', 'required'),
  },
  handler: removeStandardRuleTest,
} satisfies CommandDefinition<RemoveStandardRuleTest>;
