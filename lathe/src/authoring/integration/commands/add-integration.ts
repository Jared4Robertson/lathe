import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { IntegrationRow } from '../../../platform/data/tables.ts';
import { ADD_INTEGRATION_IDENTITY } from './identities.generated.ts';
import { addIntegration } from './handlers.generated.ts';

/** A new integration. */
export type AddIntegration = Pick<IntegrationRow, 'id' | 'title' | 'description' | 'system'>;

export const ADD_INTEGRATION = {
  ...ADD_INTEGRATION_IDENTITY,
  input: {
    id: column('integration', 'id', 'required'),
    title: column('integration', 'title', 'required'),
    description: column('integration', 'description', 'required'),
    system: column('integration', 'system', 'optional'),
  },
  handler: addIntegration,
} satisfies CommandDefinition<AddIntegration>;
