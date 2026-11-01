import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { StorageRequirementTestRow } from '../../../platform/data/tables.ts';
import { ADD_STORAGE_REQUIREMENT_TEST_IDENTITY } from './identities.generated.ts';
import { addStorageRequirementTest } from './handlers.generated.ts';

export type AddStorageRequirementTest = Pick<StorageRequirementTestRow, 'id' | 'title' | 'storage_requirement_id' | 'level' | 'state' | 'when' | 'then' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'notes'> & { starts_from?: string[] };

export const ADD_STORAGE_REQUIREMENT_TEST = {
  ...ADD_STORAGE_REQUIREMENT_TEST_IDENTITY,
  input: {
    id: column('storage_requirement_test', 'id', 'required'),
    title: column('storage_requirement_test', 'title', 'required'),
    storage_requirement_id: column('storage_requirement_test', 'storage_requirement_id', 'required'),
    level: column('storage_requirement_test', 'level', 'required'),
    state: column('storage_requirement_test', 'state', 'required'),
    when: column('storage_requirement_test', 'when', 'required'),
    then: column('storage_requirement_test', 'then', 'required'),
    file: column('storage_requirement_test', 'file', 'optional'),
    manual_reason: column('storage_requirement_test', 'manual_reason', 'optional'),
    size: column('storage_requirement_test', 'size', 'optional'),
    smoke: column('storage_requirement_test', 'smoke', 'optional'),
    external: column('storage_requirement_test', 'external', 'optional'),
    notes: column('storage_requirement_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addStorageRequirementTest,
} satisfies CommandDefinition<AddStorageRequirementTest>;
