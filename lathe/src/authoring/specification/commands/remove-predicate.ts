import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { SpecificationRepository } from '../repository.ts';
import { REMOVE_PREDICATE_IDENTITY } from './identities.generated.ts';

/** The predicate to remove. */
export type RemovePredicate = { id: string };

export const REMOVE_PREDICATE: CommandDefinition<RemovePredicate> = {
  ...REMOVE_PREDICATE_IDENTITY,
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
