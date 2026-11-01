import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_POLICY_TEST_IDENTITY } from './identities.generated.ts';
import { removePolicyTest } from './handlers.generated.ts';

/** The test to remove. */
export type RemovePolicyTest = { id: string };

export const REMOVE_POLICY_TEST = {
  ...REMOVE_POLICY_TEST_IDENTITY,
  input: {
    id: column('policy_test', 'id', 'required'),
  },
  handler: removePolicyTest,
} satisfies CommandDefinition<RemovePolicyTest>;
