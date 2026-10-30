// Change a specification test (LA-AUT-CMD267): Changes a specification test's columns or the test data sets it starts from (the whole list).
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { SpecificationTestRow } from '../../../platform/data/tables.ts';
import { SPECIFICATION_SLICE, changed } from '../model.ts';
import { SpecificationRepository } from '../repository.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangeSpecificationTest = Pick<SpecificationTestRow, 'id'> & { title?: SpecificationTestRow['title']; level?: SpecificationTestRow['level']; state?: SpecificationTestRow['state']; file?: SpecificationTestRow['file'] | null; manual_reason?: SpecificationTestRow['manual_reason'] | null; size?: SpecificationTestRow['size'] | null; smoke?: SpecificationTestRow['smoke'] | null; external?: SpecificationTestRow['external'] | null; when?: SpecificationTestRow['when']; then?: SpecificationTestRow['then']; notes?: SpecificationTestRow['notes'] | null; starts_from?: string[] };

/** Change a specification test (LA-AUT-CMD267). */
export const CHANGE_SPECIFICATION_TEST: CommandDefinition<ChangeSpecificationTest> = {
  id: 'LA-AUT-CMD267',
  slice: SPECIFICATION_SLICE,
  name: 'change-specification-test',
  description: "Changes a specification test's columns or the test data sets it starts from (the whole list).",
  method: 'POST',
  route: '/api/specification/change-specification-test',
  input: {
    id: column('specification_test', 'id', 'required'),
    title: column('specification_test', 'title', 'optional'),
    level: column('specification_test', 'level', 'optional'),
    state: column('specification_test', 'state', 'optional'),
    file: column('specification_test', 'file', 'clearable'),
    manual_reason: column('specification_test', 'manual_reason', 'clearable'),
    size: column('specification_test', 'size', 'clearable'),
    smoke: column('specification_test', 'smoke', 'clearable'),
    external: column('specification_test', 'external', 'clearable'),
    when: column('specification_test', 'when', 'optional'),
    then: column('specification_test', 'then', 'optional'),
    notes: column('specification_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changeSpecificationTest,
};

/** Changes the test's columns and the data sets it starts from. */
export function changeSpecificationTest(tx: Transaction, input: ChangeSpecificationTest): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.loadHolding('specification_test', input.id) ?? tx.refuse('missing', `there is no specification test ${input.id}`);
  const test = specification.test!;
  specification.test = { row: changed(test.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? test.startsFrom };
  specifications.save(specification);
}
