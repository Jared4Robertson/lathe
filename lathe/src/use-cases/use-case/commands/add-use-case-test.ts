import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { UseCaseTestRow } from '../../../platform/data/tables.ts';
import { ADD_USE_CASE_TEST_IDENTITY } from './identities.generated.ts';
import { addUseCaseTest } from './handlers.generated.ts';

export type AddUseCaseTest = Pick<UseCaseTestRow, 'id' | 'title' | 'uc_requirement_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'when' | 'then' | 'notes'> & { starts_from?: string[] };

export const ADD_USE_CASE_TEST = {
  ...ADD_USE_CASE_TEST_IDENTITY,
  input: {
    id: column('use_case_test', 'id', 'required'),
    title: column('use_case_test', 'title', 'required'),
    uc_requirement_id: column('use_case_test', 'uc_requirement_id', 'required'),
    level: column('use_case_test', 'level', 'required'),
    state: column('use_case_test', 'state', 'required'),
    file: column('use_case_test', 'file', 'optional'),
    manual_reason: column('use_case_test', 'manual_reason', 'optional'),
    size: column('use_case_test', 'size', 'optional'),
    smoke: column('use_case_test', 'smoke', 'optional'),
    external: column('use_case_test', 'external', 'optional'),
    when: column('use_case_test', 'when', 'required'),
    then: column('use_case_test', 'then', 'required'),
    notes: column('use_case_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addUseCaseTest,
} satisfies CommandDefinition<AddUseCaseTest>;
