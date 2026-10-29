// Remove a specification test (LA-AUT-CMD268): Removes a specification's test with the links it starts. Refused while anything references it, such as a business outcome it measures.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { SPECIFICATION_SLICE } from '../model.ts';
import { SpecificationRepository } from '../repository.ts';

/** The specification test to remove. */
export type RemoveSpecificationTest = { id: string };

/** Remove a specification test (LA-AUT-CMD268). */
export const REMOVE_SPECIFICATION_TEST: CommandDefinition<RemoveSpecificationTest> = {
  id: 'LA-AUT-CMD268',
  slice: SPECIFICATION_SLICE,
  name: 'remove-specification-test',
  description: "Removes a specification's test with the links it starts. Refused while anything references it, such as a business outcome it measures.",
  method: 'POST',
  route: '/api/specification/remove-specification-test',
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
