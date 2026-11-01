import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_INVARIANT_TEST_IDENTITY } from './identities.generated.ts';
import { removeInvariantTest } from './handlers.generated.ts';

/** The test to remove. */
export type RemoveInvariantTest = { id: string };

export const REMOVE_INVARIANT_TEST = {
  ...REMOVE_INVARIANT_TEST_IDENTITY,
  input: {
    id: column('invariant_test', 'id', 'required'),
  },
  handler: removeInvariantTest,
} satisfies CommandDefinition<RemoveInvariantTest>;
