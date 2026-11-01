import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { IntegrationTestRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { IntegrationRepository } from '../repository.ts';
import { CHANGE_INTEGRATION_TEST_IDENTITY } from './identities.generated.ts';

/** The integration test's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeIntegrationTest = Pick<IntegrationTestRow, 'id'> & { title?: IntegrationTestRow['title']; level?: IntegrationTestRow['level']; state?: IntegrationTestRow['state']; when?: IntegrationTestRow['when']; then?: IntegrationTestRow['then']; file?: IntegrationTestRow['file'] | null; manual_reason?: IntegrationTestRow['manual_reason'] | null; size?: IntegrationTestRow['size'] | null; smoke?: IntegrationTestRow['smoke'] | null; external?: IntegrationTestRow['external'] | null; notes?: IntegrationTestRow['notes'] | null; starts_from?: string[] };

export const CHANGE_INTEGRATION_TEST: CommandDefinition<ChangeIntegrationTest> = {
  ...CHANGE_INTEGRATION_TEST_IDENTITY,
  input: {
    id: column('integration_test', 'id', 'required'),
    title: column('integration_test', 'title', 'optional'),
    level: column('integration_test', 'level', 'optional'),
    state: column('integration_test', 'state', 'optional'),
    when: column('integration_test', 'when', 'optional'),
    then: column('integration_test', 'then', 'optional'),
    file: column('integration_test', 'file', 'clearable'),
    manual_reason: column('integration_test', 'manual_reason', 'clearable'),
    size: column('integration_test', 'size', 'clearable'),
    smoke: column('integration_test', 'smoke', 'clearable'),
    external: column('integration_test', 'external', 'clearable'),
    notes: column('integration_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changeIntegrationTest,
};

/** Changes the integration test's columns and links. */
export function changeIntegrationTest(tx: Transaction, input: ChangeIntegrationTest): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.loadHolding('integration_test', input.id) ?? tx.refuse('missing', `there is no integration test ${input.id}`);
  integration.tests = integration.tests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'level', 'state', 'when', 'then', 'file', 'manual_reason', 'size', 'smoke', 'external', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  integrations.save(integration);
}
