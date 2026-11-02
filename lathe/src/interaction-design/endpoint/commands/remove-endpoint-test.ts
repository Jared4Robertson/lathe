import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_ENDPOINT_TEST_IDENTITY } from './identities.generated.ts';
import { removeEndpointTest } from './handlers.generated.ts';

/** The endpoint test to remove. */
export type RemoveEndpointTest = { id: string };

export const REMOVE_ENDPOINT_TEST = {
  ...REMOVE_ENDPOINT_TEST_IDENTITY,
  input: {
    id: column('endpoint_test', 'id', 'required'),
  },
  handler: removeEndpointTest,
} satisfies CommandDefinition<RemoveEndpointTest>;
