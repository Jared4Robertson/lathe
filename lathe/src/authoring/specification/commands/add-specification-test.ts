// Add a specification test (LA-AUT-CMD266): Adds the test of a specification, its one test, with the test data sets it starts from.
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { SpecificationTestRow } from '../../../platform/data/tables.ts';
import { SPECIFICATION_SLICE } from '../model.ts';
import { SpecificationRepository } from '../repository.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import { specificationOneEach } from '../rules.ts';

/** A new specification test, with the test data sets it starts from. */
export type AddSpecificationTest = Pick<SpecificationTestRow, 'id' | 'title' | 'specification_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'when' | 'then' | 'notes'> & { starts_from?: string[] };

/** Add a specification test (LA-AUT-CMD266). */
export const ADD_SPECIFICATION_TEST: CommandDefinition<AddSpecificationTest> = {
  id: 'LA-AUT-CMD266',
  slice: SPECIFICATION_SLICE,
  name: 'add-specification-test',
  description: 'Adds the test of a specification, its one test, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/specification/add-specification-test',
  input: {
    id: column('specification_test', 'id', 'required'),
    title: column('specification_test', 'title', 'required'),
    specification_id: column('specification_test', 'specification_id', 'required'),
    level: column('specification_test', 'level', 'required'),
    state: column('specification_test', 'state', 'required'),
    file: column('specification_test', 'file', 'optional'),
    manual_reason: column('specification_test', 'manual_reason', 'optional'),
    size: column('specification_test', 'size', 'optional'),
    smoke: column('specification_test', 'smoke', 'optional'),
    external: column('specification_test', 'external', 'optional'),
    when: column('specification_test', 'when', 'required'),
    then: column('specification_test', 'then', 'required'),
    notes: column('specification_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addSpecificationTest,
};

/** Adds the test to its specification, which has none yet. */
export function addSpecificationTest(tx: Transaction, input: AddSpecificationTest): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.load(input.specification_id) ?? tx.refuse('missing', `there is no specification ${input.specification_id}`);
  const { starts_from = [], ...row } = input;
  refuseBroken(specificationOneEach([], [...(specification.test ? [specification.test.row] : []), row]));
  specification.test = { row, startsFrom: starts_from };
  specifications.save(specification);
}
