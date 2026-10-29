// Remove a term (LA-AUT-CMD168): Removes a term from its domain. Refused while anything references it.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DOMAIN_SLICE } from '../model.ts';
import { DomainRepository } from '../repository.ts';

/** The term to remove. */
export type RemoveTerm = { id: string };

/** Remove a term (LA-AUT-CMD168). */
export const REMOVE_TERM: CommandDefinition<RemoveTerm> = {
  id: 'LA-AUT-CMD168',
  slice: DOMAIN_SLICE,
  name: 'remove-term',
  description: 'Removes a term from its domain. Refused while anything references it.',
  method: 'POST',
  route: '/api/domain/remove-term',
  input: {
    id: column('term', 'id', 'required'),
  },
  handler: removeTerm,
};

/** Removes the term from its domain. */
export function removeTerm(tx: Transaction, input: RemoveTerm): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('term', input.id) ?? tx.refuse('missing', `there is no term ${input.id}`);
  domain.terms = domain.terms.filter((x) => x.id !== input.id);
  domains.save(domain);
}
