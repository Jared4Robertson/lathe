// Remove an integration test (LA-AUT-CMD343): Removes an integration test with the links it starts. Refused while anything else references them.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { INTEGRATION_SLICE } from '../model.ts';
import { IntegrationRepository } from '../repository.ts';

/** The integration test to remove. */
export type RemoveIntegrationTest = { id: string };

/** Remove an integration test (LA-AUT-CMD343). */
export const REMOVE_INTEGRATION_TEST: CommandDefinition<RemoveIntegrationTest> = {
  id: 'LA-AUT-CMD343',
  slice: INTEGRATION_SLICE,
  name: 'remove-integration-test',
  description: 'Removes an integration test with the links it starts. Refused while anything else references them.',
  method: 'POST',
  route: '/api/integration/remove-integration-test',
  input: {
    id: column('integration_test', 'id', 'required'),
  },
  handler: removeIntegrationTest,
};

/** Removes the integration test from its integration. */
export function removeIntegrationTest(tx: Transaction, input: RemoveIntegrationTest): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.loadHolding('integration_test', input.id) ?? tx.refuse('missing', `there is no integration test ${input.id}`);
  integration.tests = integration.tests.filter((x) => x.row.id !== input.id);
  integrations.save(integration);
}
