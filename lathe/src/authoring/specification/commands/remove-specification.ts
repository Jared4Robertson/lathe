// Remove a specification (LA-AUT-CMD262): Removes a specification whole: its predicate and test, and the links they start. Refused while anything outside it references what is in it, such as a command that checks it.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { SPECIFICATION_SLICE } from '../model.ts';
import { SpecificationRepository } from '../repository.ts';

/** The specification to remove. */
export type RemoveSpecification = { id: string };

/** Remove a specification (LA-AUT-CMD262). */
export const REMOVE_SPECIFICATION: CommandDefinition<RemoveSpecification> = {
  id: 'LA-AUT-CMD262',
  slice: SPECIFICATION_SLICE,
  name: 'remove-specification',
  description: 'Removes a specification whole: its predicate and test, and the links they start. Refused while anything outside it references what is in it, such as a command that checks it.',
  method: 'POST',
  route: '/api/specification/remove-specification',
  input: {
    id: column('specification', 'id', 'required'),
  },
  handler: removeSpecification,
};

/** Removes the specification whole. */
export function removeSpecification(tx: Transaction, input: RemoveSpecification): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.load(input.id) ?? tx.refuse('missing', `there is no specification ${input.id}`);
  specifications.remove(specification);
}
