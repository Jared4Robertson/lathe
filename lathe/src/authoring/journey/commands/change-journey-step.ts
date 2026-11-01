import { column, id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { JourneyStepRow } from '../../../platform/data/tables.ts';
import { CHANGE_JOURNEY_STEP_IDENTITY } from './identities.generated.ts';
import { changeJourneyStep } from './handlers.generated.ts';

/** The step's changes: a column given is set; null clears what it carries out. Its path and position change only by Move a journey step. */
export type ChangeJourneyStep = Pick<JourneyStepRow, 'id'> & { title?: string; carries_out?: string | null };

export const CHANGE_JOURNEY_STEP = {
  ...CHANGE_JOURNEY_STEP_IDENTITY,
  input: {
    id: column('journey_step', 'id', 'required'),
    title: column('journey_step', 'title', 'optional'),
    carries_out: id('The use case or policy of its product it carries out.', 'clearable'),
  },
  handler: changeJourneyStep,
} satisfies CommandDefinition<ChangeJourneyStep>;
