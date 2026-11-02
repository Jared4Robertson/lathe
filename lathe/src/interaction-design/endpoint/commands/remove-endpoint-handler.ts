import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_ENDPOINT_HANDLER_IDENTITY } from './identities.generated.ts';
import { removeEndpointHandler } from './handlers.generated.ts';

/** The endpoint handler to remove. */
export type RemoveEndpointHandler = { id: string };

export const REMOVE_ENDPOINT_HANDLER = {
  ...REMOVE_ENDPOINT_HANDLER_IDENTITY,
  input: {
    id: column('endpoint_handler', 'id', 'required'),
  },
  handler: removeEndpointHandler,
} satisfies CommandDefinition<RemoveEndpointHandler>;
