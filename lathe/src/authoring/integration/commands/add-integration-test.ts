// Add an integration test (LA-AUT-CMD341): Adds an integration test under its integration, with the test data sets it starts from.
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { IntegrationTestRow } from '../../../platform/data/tables.ts';
import { INTEGRATION_SLICE } from '../model.ts';
import { IntegrationRepository } from '../repository.ts';

/** A new integration test, with the links it starts. */
export type AddIntegrationTest = Pick<IntegrationTestRow, 'id' | 'title' | 'integration_id' | 'level' | 'state' | 'when' | 'then' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'notes'> & { starts_from?: string[] };

/** Add an integration test (LA-AUT-CMD341). */
export const ADD_INTEGRATION_TEST: CommandDefinition<AddIntegrationTest> = {
  id: 'LA-AUT-CMD341',
  slice: INTEGRATION_SLICE,
  name: 'add-integration-test',
  description: 'Adds an integration test under its integration, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/integration/add-integration-test',
  input: {
    id: column('integration_test', 'id', 'required'),
    title: column('integration_test', 'title', 'required'),
    integration_id: column('integration_test', 'integration_id', 'required'),
    level: column('integration_test', 'level', 'required'),
    state: column('integration_test', 'state', 'required'),
    when: column('integration_test', 'when', 'required'),
    then: column('integration_test', 'then', 'required'),
    file: column('integration_test', 'file', 'optional'),
    manual_reason: column('integration_test', 'manual_reason', 'optional'),
    size: column('integration_test', 'size', 'optional'),
    smoke: column('integration_test', 'smoke', 'optional'),
    external: column('integration_test', 'external', 'optional'),
    notes: column('integration_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addIntegrationTest,
};

/** Adds the integration test under its integration, with its links. */
export function addIntegrationTest(tx: Transaction, input: AddIntegrationTest): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.loadHolding('integration', input.integration_id) ?? tx.refuse('missing', `there is no integration ${input.integration_id}`);
  const { starts_from = [], ...row } = input;
  integration.tests.push({ row, startsFrom: starts_from });
  integrations.save(integration);
}
