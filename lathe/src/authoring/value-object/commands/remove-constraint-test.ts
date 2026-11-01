import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ValueObjectRepository } from '../repository.ts';
import { REMOVE_CONSTRAINT_TEST_IDENTITY } from './identities.generated.ts';

/** The constraint test to remove. */
export type RemoveConstraintTest = { id: string };

export const REMOVE_CONSTRAINT_TEST = {
  ...REMOVE_CONSTRAINT_TEST_IDENTITY,
  input: {
    id: column('constraint_test', 'id', 'required'),
  },
  handler: removeConstraintTest,
} satisfies CommandDefinition<RemoveConstraintTest>;

/** Removes the test from its value object. */
export function removeConstraintTest(tx: Transaction, input: RemoveConstraintTest): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('constraint_test', input.id) ?? tx.refuse('missing', `there is no constraint test ${input.id}`);
  valueObject.constraintTests = valueObject.constraintTests.filter((t) => t.row.id !== input.id);
  valueObjects.save(valueObject);
}
