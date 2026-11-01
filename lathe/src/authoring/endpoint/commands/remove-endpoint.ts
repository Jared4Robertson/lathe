import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_ENDPOINT_IDENTITY } from './identities.generated.ts';
import { removeEndpoint } from './handlers.generated.ts';

/** The endpoint to remove. */
export type RemoveEndpoint = { id: string };

export const REMOVE_ENDPOINT = {
  ...REMOVE_ENDPOINT_IDENTITY,
  input: {
    id: column('endpoint', 'id', 'required'),
  },
  handler: removeEndpoint,
} satisfies CommandDefinition<RemoveEndpoint>;
