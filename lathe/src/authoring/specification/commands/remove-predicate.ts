import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { SPECIFICATION_SLICE } from '../model.ts';
import { SpecificationRepository } from '../repository.ts';

/** The predicate to remove. */
export type RemovePredicate = { id: string };

export const REMOVE_PREDICATE: CommandDefinition<RemovePredicate> = {
  id: 'LA-AUT-CMD265',
  slice: SPECIFICATION_SLICE,
  name: 'remove-predicate',
  description: "Removes a specification's predicate with the links it starts and the packages it uses. Refused while anything references it.",
  method: 'POST',
  route: '/api/specification/remove-predicate',
  input: {
    id: column('predicate', 'id', 'required'),
  },
  handler: removePredicate,
};

/** Removes the predicate from its specification. */
export function removePredicate(tx: Transaction, input: RemovePredicate): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.loadHolding('predicate', input.id) ?? tx.refuse('missing', `there is no predicate ${input.id}`);
  specification.predicate = null;
  specifications.save(specification);
}
