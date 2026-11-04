import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { IntegrationTestRow } from '../../../platform/data/tables.ts';
import { CHANGE_INTEGRATION_TEST_IDENTITY } from './identities.generated.ts';
import { changeIntegrationTest } from './handlers.generated.ts';

/** The integration test's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeIntegrationTest = Pick<IntegrationTestRow, 'id'> & { title?: IntegrationTestRow['title']; level?: IntegrationTestRow['level']; state?: IntegrationTestRow['state']; when?: IntegrationTestRow['when']; then?: IntegrationTestRow['then']; file?: IntegrationTestRow['file'] | null; manual_reason?: IntegrationTestRow['manual_reason'] | null; size?: IntegrationTestRow['size'] | null; smoke?: IntegrationTestRow['smoke'] | null; external?: IntegrationTestRow['external'] | null; notes?: IntegrationTestRow['notes'] | null; starts_from?: string[] };

export const CHANGE_INTEGRATION_TEST = {
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
} satisfies CommandDefinition<ChangeIntegrationTest>;
