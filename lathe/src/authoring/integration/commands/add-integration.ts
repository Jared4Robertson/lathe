import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { IntegrationRow } from '../../../platform/data/tables.ts';
import { INTEGRATION_SLICE, newIntegration } from '../model.ts';
import { IntegrationRepository } from '../repository.ts';

/** A new integration. */
export type AddIntegration = Pick<IntegrationRow, 'id' | 'title' | 'description' | 'system'>;

export const ADD_INTEGRATION: CommandDefinition<AddIntegration> = {
  id: 'LA-AUT-CMD335',
  slice: INTEGRATION_SLICE,
  name: 'add-integration',
  description: 'Adds an integration: an outside system the product exchanges with. It has no owner; its product follows from its ID.',
  method: 'POST',
  route: '/api/integration/add-integration',
  input: {
    id: column('integration', 'id', 'required'),
    title: column('integration', 'title', 'required'),
    description: column('integration', 'description', 'required'),
    system: column('integration', 'system', 'optional'),
  },
  handler: addIntegration,
};

/** Adds the integration, new and whole. */
export function addIntegration(tx: Transaction, input: AddIntegration): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.create(newIntegration(input));
  integrations.save(integration);
}
