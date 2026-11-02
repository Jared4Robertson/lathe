import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_FLOW_TEST_IDENTITY } from './identities.generated.ts';
import { removeFlowTest } from './handlers.generated.ts';

/** The test to remove. */
export type RemoveFlowTest = { id: string };

export const REMOVE_FLOW_TEST = {
  ...REMOVE_FLOW_TEST_IDENTITY,
  input: {
    id: column('flow_test', 'id', 'required'),
  },
  handler: removeFlowTest,
} satisfies CommandDefinition<RemoveFlowTest>;
