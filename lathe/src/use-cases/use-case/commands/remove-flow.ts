import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_FLOW_IDENTITY } from './identities.generated.ts';
import { removeFlow } from './handlers.generated.ts';

/** The flow to remove. */
export type RemoveFlow = { id: string };

export const REMOVE_FLOW = {
  ...REMOVE_FLOW_IDENTITY,
  input: {
    id: column('flow', 'id', 'required'),
  },
  handler: removeFlow,
} satisfies CommandDefinition<RemoveFlow>;
