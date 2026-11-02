import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_QUERY_IDENTITY } from './identities.generated.ts';
import { removeQuery } from './handlers.generated.ts';

/** The query to remove. */
export type RemoveQuery = { id: string };

export const REMOVE_QUERY = {
  ...REMOVE_QUERY_IDENTITY,
  input: {
    id: column('query', 'id', 'required'),
  },
  handler: removeQuery,
} satisfies CommandDefinition<RemoveQuery>;
