import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { INTEGRATION_SLICE } from '../model.ts';
import { IntegrationRepository } from '../repository.ts';

/** The integration to remove. */
export type RemoveIntegration = { id: string };

export const REMOVE_INTEGRATION: CommandDefinition<RemoveIntegration> = {
  id: 'LA-AUT-CMD337',
  slice: INTEGRATION_SLICE,
  name: 'remove-integration',
  description: 'Removes an integration whole: its adapter, its integration tests and the links they start. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/integration/remove-integration',
  input: {
    id: column('integration', 'id', 'required'),
  },
  handler: removeIntegration,
};

/** Removes the integration whole. */
export function removeIntegration(tx: Transaction, input: RemoveIntegration): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.load(input.id) ?? tx.refuse('missing', `there is no integration ${input.id}`);
  integrations.remove(integration);
}
