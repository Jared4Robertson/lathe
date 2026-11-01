import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { IntegrationRow } from '../../../platform/data/tables.ts';
import { newIntegration } from '../model.ts';
import { IntegrationRepository } from '../repository.ts';
import { ADD_INTEGRATION_IDENTITY } from './identities.generated.ts';

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

/** Adds the integration, new and whole. */
export function addIntegration(tx: Transaction, input: AddIntegration): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.create(newIntegration(input));
  integrations.save(integration);
}
