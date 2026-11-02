import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_CONSTRAINT_IDENTITY } from './identities.generated.ts';
import { removeConstraint } from './handlers.generated.ts';

/** The constraint to remove. */
export type RemoveConstraint = { id: string };

export const REMOVE_CONSTRAINT = {
  ...REMOVE_CONSTRAINT_IDENTITY,
  input: {
    id: column('constraint', 'id', 'required'),
  },
  handler: removeConstraint,
} satisfies CommandDefinition<RemoveConstraint>;
