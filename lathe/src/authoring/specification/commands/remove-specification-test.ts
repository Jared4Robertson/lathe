import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { SpecificationRepository } from '../repository.ts';
import { REMOVE_SPECIFICATION_TEST_IDENTITY } from './identities.generated.ts';

/** The specification test to remove. */
export type RemoveSpecificationTest = { id: string };

export const REMOVE_SPECIFICATION_TEST: CommandDefinition<RemoveSpecificationTest> = {
  ...REMOVE_SPECIFICATION_TEST_IDENTITY,
  input: {
    id: column('specification_test', 'id', 'required'),
  },
  handler: removeSpecificationTest,
};

/** Removes the test from its specification. */
export function removeSpecificationTest(tx: Transaction, input: RemoveSpecificationTest): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.loadHolding('specification_test', input.id) ?? tx.refuse('missing', `there is no specification test ${input.id}`);
  specification.test = null;
  specifications.save(specification);
}
