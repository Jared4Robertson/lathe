import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_INVARIANT_IDENTITY } from './identities.generated.ts';
import { removeInvariant } from './handlers.generated.ts';

/** The invariant to remove. */
export type RemoveInvariant = { id: string };

export const REMOVE_INVARIANT = {
  ...REMOVE_INVARIANT_IDENTITY,
  input: {
    id: column('invariant', 'id', 'required'),
  },
  handler: removeInvariant,
} satisfies CommandDefinition<RemoveInvariant>;
