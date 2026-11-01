import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { IntegrationRepository } from '../repository.ts';
import { REMOVE_INTEGRATION_TEST_IDENTITY } from './identities.generated.ts';

/** The integration test to remove. */
export type RemoveIntegrationTest = { id: string };

export const REMOVE_INTEGRATION_TEST = {
  ...REMOVE_INTEGRATION_TEST_IDENTITY,
  input: {
    id: column('integration_test', 'id', 'required'),
  },
  handler: removeIntegrationTest,
} satisfies CommandDefinition<RemoveIntegrationTest>;

/** Removes the integration test from its integration. */
export function removeIntegrationTest(tx: Transaction, input: RemoveIntegrationTest): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.loadHolding('integration_test', input.id) ?? tx.refuse('missing', `there is no integration test ${input.id}`);
  integration.tests = integration.tests.filter((x) => x.row.id !== input.id);
  integrations.save(integration);
}
