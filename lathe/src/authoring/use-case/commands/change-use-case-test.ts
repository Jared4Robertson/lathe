// Change a use case test (LA-AUT-CMD114): Changes a use case test's columns or the test data sets it starts from (the whole list).
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { UseCaseTestRow } from '../../../platform/data/tables.ts';
import { changed, USE_CASE_SLICE, useCaseChanged } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangeUseCaseTest = Pick<UseCaseTestRow, 'id'> & { title?: UseCaseTestRow['title']; level?: UseCaseTestRow['level']; state?: UseCaseTestRow['state']; when?: UseCaseTestRow['when']; then?: UseCaseTestRow['then']; file?: UseCaseTestRow['file'] | null; manual_reason?: UseCaseTestRow['manual_reason'] | null; size?: UseCaseTestRow['size'] | null; smoke?: UseCaseTestRow['smoke'] | null; external?: UseCaseTestRow['external'] | null; notes?: UseCaseTestRow['notes'] | null; starts_from?: string[] };

/** Change a use case test (LA-AUT-CMD114). */
export const CHANGE_USE_CASE_TEST: CommandDefinition<ChangeUseCaseTest> = {
  id: 'LA-AUT-CMD114',
  slice: USE_CASE_SLICE,
  name: 'change-use-case-test',
  description: "Changes a use case test's columns or the test data sets it starts from (the whole list).",
  method: 'POST',
  route: '/api/use-case/change-use-case-test',
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
};

/** Changes the test's columns and the data sets it starts from. */
export function changeUseCaseTest(tx: Transaction, input: ChangeUseCaseTest): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('use_case_test', input.id) ?? tx.refuse('missing', `there is no use case test ${input.id}`);
  useCase.useCaseTests = useCase.useCaseTests.map((test) =>
    test.row.id === input.id ? { row: changed(test.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? test.startsFrom } : test,
  );
  holdToRules(tx, useCase);
  useCases.save(useCase);
  useCaseChanged(tx, useCase);
}
