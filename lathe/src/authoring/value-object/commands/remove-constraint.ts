import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ValueObjectRepository } from '../repository.ts';
import { REMOVE_CONSTRAINT_IDENTITY } from './identities.generated.ts';

/** The constraint to remove. */
export type RemoveConstraint = { id: string };

export const REMOVE_CONSTRAINT = {
  ...REMOVE_CONSTRAINT_IDENTITY,
  input: {
    id: column('constraint', 'id', 'required'),
  },
  handler: removeConstraint,
} satisfies CommandDefinition<RemoveConstraint>;

/** Removes the constraint and its test from its value object. */
export function removeConstraint(tx: Transaction, input: RemoveConstraint): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('constraint', input.id) ?? tx.refuse('missing', `there is no constraint ${input.id}`);
  valueObject.constraints = valueObject.constraints.filter((c) => c.id !== input.id);
  valueObject.constraintTests = valueObject.constraintTests.filter((t) => t.row.constraint_id !== input.id);
  valueObjects.save(valueObject);
}
