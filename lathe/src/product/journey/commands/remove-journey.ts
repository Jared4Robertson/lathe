import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_JOURNEY_IDENTITY } from './identities.generated.ts';
import { removeJourney } from './handlers.generated.ts';

/** The journey to remove. */
export type RemoveJourney = { id: string };

export const REMOVE_JOURNEY = {
  ...REMOVE_JOURNEY_IDENTITY,
  input: {
    id: column('journey', 'id', 'required'),
  },
  handler: removeJourney,
} satisfies CommandDefinition<RemoveJourney>;
