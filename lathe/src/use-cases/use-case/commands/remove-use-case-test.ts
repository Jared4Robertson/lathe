import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_USE_CASE_TEST_IDENTITY } from './identities.generated.ts';
import { removeUseCaseTest } from './handlers.generated.ts';

/** The test to remove. */
export type RemoveUseCaseTest = { id: string };

export const REMOVE_USE_CASE_TEST = {
  ...REMOVE_USE_CASE_TEST_IDENTITY,
  input: {
    id: column('use_case_test', 'id', 'required'),
  },
  handler: removeUseCaseTest,
} satisfies CommandDefinition<RemoveUseCaseTest>;
