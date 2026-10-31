import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ConstraintTestRow } from '../../../platform/data/tables.ts';
import { VALUE_OBJECT_SLICE } from '../model.ts';
import { ValueObjectRepository } from '../repository.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import { valueObjectOneEach } from '../rules.ts';

export type AddConstraintTest = Pick<ConstraintTestRow, 'id' | 'title' | 'constraint_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'accepts' | 'refuses' | 'notes'> & { starts_from?: string[] };

export const ADD_CONSTRAINT_TEST: CommandDefinition<AddConstraintTest> = {
  id: 'LA-AUT-CMD279',
  slice: VALUE_OBJECT_SLICE,
  name: 'add-constraint-test',
  description: 'Adds the test of a constraint, its one test, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/value-object/add-constraint-test',
  input: {
    id: column('constraint_test', 'id', 'required'),
    title: column('constraint_test', 'title', 'required'),
    constraint_id: column('constraint_test', 'constraint_id', 'required'),
    level: column('constraint_test', 'level', 'required'),
    state: column('constraint_test', 'state', 'required'),
    file: column('constraint_test', 'file', 'optional'),
    manual_reason: column('constraint_test', 'manual_reason', 'optional'),
    size: column('constraint_test', 'size', 'optional'),
    smoke: column('constraint_test', 'smoke', 'optional'),
    external: column('constraint_test', 'external', 'optional'),
    accepts: column('constraint_test', 'accepts', 'required'),
    refuses: column('constraint_test', 'refuses', 'required'),
    notes: column('constraint_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addConstraintTest,
};

/** Adds the test to its constraint, which has none yet. */
export function addConstraintTest(tx: Transaction, input: AddConstraintTest): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('constraint', input.constraint_id) ?? tx.refuse('missing', `there is no constraint ${input.constraint_id}`);
  const { starts_from = [], ...row } = input;
  refuseBroken(valueObjectOneEach([], [...valueObject.constraintTests.map((t) => t.row), row]));
  valueObject.constraintTests.push({ row, startsFrom: starts_from });
  valueObjects.save(valueObject);
}
