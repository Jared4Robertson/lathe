// Remove a constraint (LA-AUT-CMD275): Removes a constraint with its test and the links it starts. Refused while anything else references them.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { VALUE_OBJECT_SLICE } from '../model.ts';
import { ValueObjectRepository } from '../repository.ts';

/** The constraint to remove. */
export type RemoveConstraint = { id: string };

/** Remove a constraint (LA-AUT-CMD275). */
export const REMOVE_CONSTRAINT: CommandDefinition<RemoveConstraint> = {
  id: 'LA-AUT-CMD275',
  slice: VALUE_OBJECT_SLICE,
  name: 'remove-constraint',
  description: 'Removes a constraint with its test and the links it starts. Refused while anything else references them.',
  method: 'POST',
  route: '/api/value-object/remove-constraint',
  input: {
    id: column('constraint', 'id', 'required'),
  },
  handler: removeConstraint,
};

/** Removes the constraint and its test from its value object. */
export function removeConstraint(tx: Transaction, input: RemoveConstraint): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('constraint', input.id) ?? tx.refuse('missing', `there is no constraint ${input.id}`);
  valueObject.constraints = valueObject.constraints.filter((c) => c.id !== input.id);
  valueObject.constraintTests = valueObject.constraintTests.filter((t) => t.row.constraint_id !== input.id);
  valueObjects.save(valueObject);
}
