// Add a use case test (LA-AUT-CMD113): Adds a use case test under its UC requirement, with the test data sets it starts from.
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { UseCaseTestRow } from '../../../platform/data/tables.ts';
import { USE_CASE_SLICE, useCaseChanged } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new use case test, with the test data sets it starts from. */
export type AddUseCaseTest = Pick<UseCaseTestRow, 'id' | 'title' | 'uc_requirement_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'when' | 'then' | 'notes'> & { starts_from?: string[] };

/** Add a use case test (LA-AUT-CMD113). */
export const ADD_USE_CASE_TEST: CommandDefinition<AddUseCaseTest> = {
  id: 'LA-AUT-CMD113',
  slice: USE_CASE_SLICE,
  name: 'add-use-case-test',
  description: 'Adds a use case test under its UC requirement, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/use-case/add-use-case-test',
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
};

/** Adds the test under its UC requirement. */
export function addUseCaseTest(tx: Transaction, input: AddUseCaseTest): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('uc_requirement', input.uc_requirement_id) ?? tx.refuse('missing', `there is no UC requirement ${input.uc_requirement_id}`);
  const { starts_from = [], ...row } = input;
  useCase.useCaseTests.push({ row, startsFrom: starts_from });
  holdToRules(tx, useCase);
  useCases.save(useCase);
  useCaseChanged(tx, useCase);
}
