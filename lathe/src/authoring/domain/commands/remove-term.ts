import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_TERM_IDENTITY } from './identities.generated.ts';
import { removeTerm } from './handlers.generated.ts';

/** The term to remove. */
export type RemoveTerm = { id: string };

export const REMOVE_TERM = {
  ...REMOVE_TERM_IDENTITY,
  input: {
    id: column('term', 'id', 'required'),
  },
  handler: removeTerm,
} satisfies CommandDefinition<RemoveTerm>;
