import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { UseCaseTestRow } from '../../../platform/data/tables.ts';
import { CHANGE_USE_CASE_TEST_IDENTITY } from './identities.generated.ts';
import { changeUseCaseTest } from './handlers.generated.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangeUseCaseTest = Pick<UseCaseTestRow, 'id'> & { title?: UseCaseTestRow['title']; level?: UseCaseTestRow['level']; state?: UseCaseTestRow['state']; when?: UseCaseTestRow['when']; then?: UseCaseTestRow['then']; file?: UseCaseTestRow['file'] | null; manual_reason?: UseCaseTestRow['manual_reason'] | null; size?: UseCaseTestRow['size'] | null; smoke?: UseCaseTestRow['smoke'] | null; external?: UseCaseTestRow['external'] | null; notes?: UseCaseTestRow['notes'] | null; starts_from?: string[] };

export const CHANGE_USE_CASE_TEST = {
  ...CHANGE_USE_CASE_TEST_IDENTITY,
  input: {
    id: column('use_case_test', 'id', 'required'),
    title: column('use_case_test', 'title', 'optional'),
    level: column('use_case_test', 'level', 'optional'),
    state: column('use_case_test', 'state', 'optional'),
    file: column('use_case_test', 'file', 'clearable'),
    manual_reason: column('use_case_test', 'manual_reason', 'clearable'),
    size: column('use_case_test', 'size', 'clearable'),
    smoke: column('use_case_test', 'smoke', 'clearable'),
    external: column('use_case_test', 'external', 'clearable'),
    when: column('use_case_test', 'when', 'optional'),
    then: column('use_case_test', 'then', 'optional'),
    notes: column('use_case_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changeUseCaseTest,
} satisfies CommandDefinition<ChangeUseCaseTest>;
