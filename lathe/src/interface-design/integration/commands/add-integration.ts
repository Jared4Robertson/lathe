import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { IntegrationRow } from '../../../platform/data/tables.ts';
import { ADD_INTEGRATION_IDENTITY } from './identities.generated.ts';
import { addIntegration } from './handlers.generated.ts';

/** A new integration, with the use cases it performs on its own. */
export type AddIntegration = Pick<IntegrationRow, 'id' | 'title' | 'description' | 'system'> & { performs?: string[] };

export const ADD_INTEGRATION = {
  ...ADD_INTEGRATION_IDENTITY,
  input: {
    id: column('integration', 'id', 'required'),
    title: column('integration', 'title', 'required'),
    description: column('integration', 'description', 'required'),
    system: column('integration', 'system', 'optional'),
    performs: ids('The use cases of its product it performs on its own, with no person and no interface of the product.', 'optional'),
  },
  handler: addIntegration,
} satisfies CommandDefinition<AddIntegration>;
