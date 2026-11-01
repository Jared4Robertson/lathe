import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { StorageRequirementTestRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { StorageRequirementRepository } from '../repository.ts';
import { CHANGE_STORAGE_REQUIREMENT_TEST_IDENTITY } from './identities.generated.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangeStorageRequirementTest = Pick<StorageRequirementTestRow, 'id'> & { title?: StorageRequirementTestRow['title']; level?: StorageRequirementTestRow['level']; state?: StorageRequirementTestRow['state']; file?: StorageRequirementTestRow['file'] | null; manual_reason?: StorageRequirementTestRow['manual_reason'] | null; size?: StorageRequirementTestRow['size'] | null; smoke?: StorageRequirementTestRow['smoke'] | null; external?: StorageRequirementTestRow['external'] | null; when?: StorageRequirementTestRow['when']; then?: StorageRequirementTestRow['then']; notes?: StorageRequirementTestRow['notes'] | null; starts_from?: string[] };

export const CHANGE_STORAGE_REQUIREMENT_TEST: CommandDefinition<ChangeStorageRequirementTest> = {
  ...CHANGE_STORAGE_REQUIREMENT_TEST_IDENTITY,
  input: {
    id: column('storage_requirement_test', 'id', 'required'),
    title: column('storage_requirement_test', 'title', 'optional'),
    level: column('storage_requirement_test', 'level', 'optional'),
    state: column('storage_requirement_test', 'state', 'optional'),
    file: column('storage_requirement_test', 'file', 'clearable'),
    manual_reason: column('storage_requirement_test', 'manual_reason', 'clearable'),
    size: column('storage_requirement_test', 'size', 'clearable'),
    smoke: column('storage_requirement_test', 'smoke', 'clearable'),
    external: column('storage_requirement_test', 'external', 'clearable'),
    when: column('storage_requirement_test', 'when', 'optional'),
    then: column('storage_requirement_test', 'then', 'optional'),
    notes: column('storage_requirement_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changeStorageRequirementTest,
};

/** Changes the test's columns and the data sets it starts from. */
export function changeStorageRequirementTest(tx: Transaction, input: ChangeStorageRequirementTest): void {
  const requirements = new StorageRequirementRepository(tx);
  const requirement = requirements.loadHolding('storage_requirement_test', input.id) ?? tx.refuse('missing', `there is no storage requirement test ${input.id}`);
  requirement.tests = requirement.tests.map((t) =>
    t.row.id === input.id
      ? { row: changed(t.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? t.startsFrom }
      : t,
  );
  requirements.save(requirement);
}
