import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_QUERY_HANDLER_IDENTITY } from './identities.generated.ts';
import { removeQueryHandler } from './handlers.generated.ts';

/** The query handler to remove. */
export type RemoveQueryHandler = { id: string };

export const REMOVE_QUERY_HANDLER = {
  ...REMOVE_QUERY_HANDLER_IDENTITY,
  input: {
    id: column('query_handler', 'id', 'required'),
  },
  handler: removeQueryHandler,
} satisfies CommandDefinition<RemoveQueryHandler>;
