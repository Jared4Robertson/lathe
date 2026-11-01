import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { IntegrationRepository } from '../repository.ts';
import { REMOVE_INTEGRATION_IDENTITY } from './identities.generated.ts';

/** The integration to remove. */
export type RemoveIntegration = { id: string };

export const REMOVE_INTEGRATION = {
  ...REMOVE_INTEGRATION_IDENTITY,
  input: {
    id: column('integration', 'id', 'required'),
  },
  handler: removeIntegration,
} satisfies CommandDefinition<RemoveIntegration>;

/** Removes the integration whole. */
export function removeIntegration(tx: Transaction, input: RemoveIntegration): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.load(input.id) ?? tx.refuse('missing', `there is no integration ${input.id}`);
  integrations.remove(integration);
}
