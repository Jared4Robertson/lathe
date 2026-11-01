import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_PROJECTION_IDENTITY } from './identities.generated.ts';
import { removeProjection } from './handlers.generated.ts';

/** The projection to remove. */
export type RemoveProjection = { id: string };

export const REMOVE_PROJECTION = {
  ...REMOVE_PROJECTION_IDENTITY,
  input: {
    id: column('projection', 'id', 'required'),
  },
  handler: removeProjection,
} satisfies CommandDefinition<RemoveProjection>;
