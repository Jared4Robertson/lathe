import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_INTEGRATION_TEST_IDENTITY } from './identities.generated.ts';
import { removeIntegrationTest } from './handlers.generated.ts';

/** The integration test to remove. */
export type RemoveIntegrationTest = { id: string };

export const REMOVE_INTEGRATION_TEST = {
  ...REMOVE_INTEGRATION_TEST_IDENTITY,
  input: {
    id: column('integration_test', 'id', 'required'),
  },
  handler: removeIntegrationTest,
} satisfies CommandDefinition<RemoveIntegrationTest>;
