import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { IntegrationRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { IntegrationRepository } from '../repository.ts';
import { CHANGE_INTEGRATION_IDENTITY } from './identities.generated.ts';

/** The integration's changes: a column given is set, null clears an optional one. */
export type ChangeIntegration = Pick<IntegrationRow, 'id'> & { title?: IntegrationRow['title']; description?: IntegrationRow['description']; system?: IntegrationRow['system'] | null };

export const CHANGE_INTEGRATION: CommandDefinition<ChangeIntegration> = {
  ...CHANGE_INTEGRATION_IDENTITY,
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
