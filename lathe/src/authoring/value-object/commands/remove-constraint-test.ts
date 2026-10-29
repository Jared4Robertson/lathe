// Remove a constraint test (LA-AUT-CMD281): Removes a constraint's test with the links it starts. Refused while anything references it, such as a business outcome it measures.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { VALUE_OBJECT_SLICE } from '../model.ts';
import { ValueObjectRepository } from '../repository.ts';

/** The constraint test to remove. */
export type RemoveConstraintTest = { id: string };

/** Remove a constraint test (LA-AUT-CMD281). */
export const REMOVE_CONSTRAINT_TEST: CommandDefinition<RemoveConstraintTest> = {
  id: 'LA-AUT-CMD281',
  slice: VALUE_OBJECT_SLICE,
  name: 'remove-constraint-test',
  description: "Removes a constraint's test with the links it starts. Refused while anything references it, such as a business outcome it measures.",
  method: 'POST',
  route: '/api/value-object/remove-constraint-test',
  input: {
    id: column('constraint_test', 'id', 'required'),
  },
  handler: removeConstraintTest,
};

/** Removes the test from its value object. */
export function removeConstraintTest(tx: Transaction, input: RemoveConstraintTest): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('constraint_test', input.id) ?? tx.refuse('missing', `there is no constraint test ${input.id}`);
  valueObject.constraintTests = valueObject.constraintTests.filter((t) => t.row.id !== input.id);
  valueObjects.save(valueObject);
}
