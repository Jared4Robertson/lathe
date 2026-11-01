import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ConstraintRow } from '../../../platform/data/tables.ts';
import { ValueObjectRepository } from '../repository.ts';
import { ADD_CONSTRAINT_IDENTITY } from './identities.generated.ts';

/** A new constraint. */
export type AddConstraint = Pick<ConstraintRow, 'id' | 'title' | 'value_object_id' | 'statement'>;

export const ADD_CONSTRAINT: CommandDefinition<AddConstraint> = {
  ...ADD_CONSTRAINT_IDENTITY,
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
