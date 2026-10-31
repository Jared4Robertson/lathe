import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { IntegrationRow } from '../../../platform/data/tables.ts';
import { changed, INTEGRATION_SLICE } from '../model.ts';
import { IntegrationRepository } from '../repository.ts';

/** The integration's changes: a column given is set, null clears an optional one. */
export type ChangeIntegration = Pick<IntegrationRow, 'id'> & { title?: IntegrationRow['title']; description?: IntegrationRow['description']; system?: IntegrationRow['system'] | null };

export const CHANGE_INTEGRATION: CommandDefinition<ChangeIntegration> = {
  id: 'LA-AUT-CMD336',
  slice: INTEGRATION_SLICE,
  name: 'change-integration',
  description: "Changes an integration's title, system or description.",
  method: 'POST',
  route: '/api/integration/change-integration',
  input: {
    id: column('integration', 'id', 'required'),
    title: column('integration', 'title', 'optional'),
    description: column('integration', 'description', 'optional'),
    system: column('integration', 'system', 'clearable'),
  },
  handler: changeIntegration,
};

/** Changes the integration's columns. */
export function changeIntegration(tx: Transaction, input: ChangeIntegration): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.load(input.id) ?? tx.refuse('missing', `there is no integration ${input.id}`);
  integration.integration = changed(integration.integration, input, ['title', 'description', 'system']);
  integrations.save(integration);
}
