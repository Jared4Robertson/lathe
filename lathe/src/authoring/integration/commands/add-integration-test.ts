import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { IntegrationTestRow } from '../../../platform/data/tables.ts';
import { IntegrationRepository } from '../repository.ts';
import { ADD_INTEGRATION_TEST_IDENTITY } from './identities.generated.ts';

export type AddIntegrationTest = Pick<IntegrationTestRow, 'id' | 'title' | 'integration_id' | 'level' | 'state' | 'when' | 'then' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'notes'> & { starts_from?: string[] };

export const ADD_INTEGRATION_TEST: CommandDefinition<AddIntegrationTest> = {
  ...ADD_INTEGRATION_TEST_IDENTITY,
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

export function addIntegrationTest(tx: Transaction, input: AddIntegrationTest): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.loadHolding('integration', input.integration_id) ?? tx.refuse('missing', `there is no integration ${input.integration_id}`);
  const { starts_from = [], ...row } = input;
  integration.tests.push({ row, startsFrom: starts_from });
  integrations.save(integration);
}
