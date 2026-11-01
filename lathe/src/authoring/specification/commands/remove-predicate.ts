import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_PREDICATE_IDENTITY } from './identities.generated.ts';
import { removePredicate } from './handlers.generated.ts';

/** The predicate to remove. */
export type RemovePredicate = { id: string };

export const REMOVE_PREDICATE = {
  ...REMOVE_PREDICATE_IDENTITY,
  input: {
    id: column('predicate', 'id', 'required'),
  },
  handler: removePredicate,
} satisfies CommandDefinition<RemovePredicate>;
