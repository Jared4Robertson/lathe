import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_FLOW_STEP_IDENTITY } from './identities.generated.ts';
import { removeFlowStep } from './handlers.generated.ts';

/** The step to remove. */
export type RemoveFlowStep = { id: string };

export const REMOVE_FLOW_STEP = {
  ...REMOVE_FLOW_STEP_IDENTITY,
  input: {
    id: column('flow_step', 'id', 'required'),
  },
  handler: removeFlowStep,
} satisfies CommandDefinition<RemoveFlowStep>;
