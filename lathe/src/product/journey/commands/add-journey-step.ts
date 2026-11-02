import { column, id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { JourneyStepRow } from '../../../platform/data/tables.ts';
import { ADD_JOURNEY_STEP_IDENTITY } from './identities.generated.ts';
import { addJourneyStep } from './handlers.generated.ts';

export type AddJourneyStep = Pick<JourneyStepRow, 'id' | 'title' | 'journey_id' | 'path' | 'position'> & { carries_out?: string };

export const ADD_JOURNEY_STEP = {
  ...ADD_JOURNEY_STEP_IDENTITY,
  input: {
    id: column('journey_step', 'id', 'required'),
    title: column('journey_step', 'title', 'required'),
    journey_id: column('journey_step', 'journey_id', 'required'),
    path: column('journey_step', 'path', 'required'),
    position: column('journey_step', 'position', 'required'),
    carries_out: id('The use case or policy of its product it carries out; none yet is a use case still to write.', 'optional'),
  },
  handler: addJourneyStep,
} satisfies CommandDefinition<AddJourneyStep>;
