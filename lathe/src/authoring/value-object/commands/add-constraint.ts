// Add a constraint (LA-AUT-CMD273): Adds a constraint to its value object: a rule each value is held to when it is created.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ConstraintRow } from '../../../platform/data/tables.ts';
import { VALUE_OBJECT_SLICE } from '../model.ts';
import { ValueObjectRepository } from '../repository.ts';

/** A new constraint. */
export type AddConstraint = Pick<ConstraintRow, 'id' | 'title' | 'value_object_id' | 'statement'>;

/** Add a constraint (LA-AUT-CMD273). */
export const ADD_CONSTRAINT: CommandDefinition<AddConstraint> = {
  id: 'LA-AUT-CMD273',
  slice: VALUE_OBJECT_SLICE,
  name: 'add-constraint',
  description: 'Adds a constraint to its value object: a rule each value is held to when it is created.',
  method: 'POST',
  route: '/api/value-object/add-constraint',
  input: {
    id: column('constraint', 'id', 'required'),
    title: column('constraint', 'title', 'required'),
    value_object_id: column('constraint', 'value_object_id', 'required'),
    statement: column('constraint', 'statement', 'required'),
  },
  handler: addConstraint,
};

/** Adds the constraint to its value object. */
export function addConstraint(tx: Transaction, input: AddConstraint): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.load(input.value_object_id) ?? tx.refuse('missing', `there is no value object ${input.value_object_id}`);
  valueObject.constraints.push(input);
  valueObjects.save(valueObject);
}
