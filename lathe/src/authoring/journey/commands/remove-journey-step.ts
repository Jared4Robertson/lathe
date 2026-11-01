import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_JOURNEY_STEP_IDENTITY } from './identities.generated.ts';
import { removeJourneyStep } from './handlers.generated.ts';

/** The step to remove. */
export type RemoveJourneyStep = { id: string };

export const REMOVE_JOURNEY_STEP = {
  ...REMOVE_JOURNEY_STEP_IDENTITY,
  input: {
    id: column('journey_step', 'id', 'required'),
  },
  handler: removeJourneyStep,
} satisfies CommandDefinition<RemoveJourneyStep>;
