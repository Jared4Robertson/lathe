import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_INTEGRATION_IDENTITY } from './identities.generated.ts';
import { removeIntegration } from './handlers.generated.ts';

/** The integration to remove. */
export type RemoveIntegration = { id: string };

export const REMOVE_INTEGRATION = {
  ...REMOVE_INTEGRATION_IDENTITY,
  input: {
    id: column('integration', 'id', 'required'),
  },
  handler: removeIntegration,
} satisfies CommandDefinition<RemoveIntegration>;
