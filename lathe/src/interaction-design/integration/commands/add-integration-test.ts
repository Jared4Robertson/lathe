import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { IntegrationTestRow } from '../../../platform/data/tables.ts';
import { ADD_INTEGRATION_TEST_IDENTITY } from './identities.generated.ts';
import { addIntegrationTest } from './handlers.generated.ts';

export type AddIntegrationTest = Pick<IntegrationTestRow, 'id' | 'title' | 'integration_id' | 'level' | 'state' | 'when' | 'then' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'notes'> & { starts_from?: string[] };

export const ADD_INTEGRATION_TEST = {
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
} satisfies CommandDefinition<AddIntegrationTest>;
