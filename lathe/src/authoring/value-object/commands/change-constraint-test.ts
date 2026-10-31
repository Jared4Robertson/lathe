import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ConstraintTestRow } from '../../../platform/data/tables.ts';
import { VALUE_OBJECT_SLICE, changed } from '../model.ts';
import { ValueObjectRepository } from '../repository.ts';

/** The test's changes: a column given is set, null clears an optional one; starts_from, when given, replaces the list. */
export type ChangeConstraintTest = Pick<ConstraintTestRow, 'id'> & { title?: ConstraintTestRow['title']; level?: ConstraintTestRow['level']; state?: ConstraintTestRow['state']; file?: ConstraintTestRow['file'] | null; manual_reason?: ConstraintTestRow['manual_reason'] | null; size?: ConstraintTestRow['size'] | null; smoke?: ConstraintTestRow['smoke'] | null; external?: ConstraintTestRow['external'] | null; accepts?: ConstraintTestRow['accepts']; refuses?: ConstraintTestRow['refuses']; notes?: ConstraintTestRow['notes'] | null; starts_from?: string[] };

export const CHANGE_CONSTRAINT_TEST: CommandDefinition<ChangeConstraintTest> = {
  id: 'LA-AUT-CMD280',
  slice: VALUE_OBJECT_SLICE,
  name: 'change-constraint-test',
  description: "Changes a constraint test's columns or the test data sets it starts from (the whole list).",
  method: 'POST',
  route: '/api/value-object/change-constraint-test',
  input: {
    id: column('constraint_test', 'id', 'required'),
    title: column('constraint_test', 'title', 'optional'),
    level: column('constraint_test', 'level', 'optional'),
    state: column('constraint_test', 'state', 'optional'),
    file: column('constraint_test', 'file', 'clearable'),
    manual_reason: column('constraint_test', 'manual_reason', 'clearable'),
    size: column('constraint_test', 'size', 'clearable'),
    smoke: column('constraint_test', 'smoke', 'clearable'),
    external: column('constraint_test', 'external', 'clearable'),
    accepts: column('constraint_test', 'accepts', 'optional'),
    refuses: column('constraint_test', 'refuses', 'optional'),
    notes: column('constraint_test', 'notes', 'clearable'),
    starts_from: ids('The test data sets it starts from. Replaces the list.', 'optional'),
  },
  handler: changeConstraintTest,
};

/** Changes the test's columns and the data sets it starts from. */
export function changeConstraintTest(tx: Transaction, input: ChangeConstraintTest): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('constraint_test', input.id) ?? tx.refuse('missing', `there is no constraint test ${input.id}`);
  valueObject.constraintTests = valueObject.constraintTests.map((t) => (t.row.id === input.id ? { row: changed(t.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'accepts', 'refuses', 'notes']), startsFrom: input.starts_from ?? t.startsFrom } : t));
  valueObjects.save(valueObject);
}
