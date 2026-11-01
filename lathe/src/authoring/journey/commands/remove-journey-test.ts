import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_JOURNEY_TEST_IDENTITY } from './identities.generated.ts';
import { removeJourneyTest } from './handlers.generated.ts';

/** The test to remove. */
export type RemoveJourneyTest = { id: string };

export const REMOVE_JOURNEY_TEST = {
  ...REMOVE_JOURNEY_TEST_IDENTITY,
  input: {
    id: column('journey_test', 'id', 'required'),
  },
  handler: removeJourneyTest,
} satisfies CommandDefinition<RemoveJourneyTest>;
