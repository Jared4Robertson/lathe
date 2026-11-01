import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DomainRepository } from '../repository.ts';
import { REMOVE_TERM_IDENTITY } from './identities.generated.ts';

/** The term to remove. */
export type RemoveTerm = { id: string };

export const REMOVE_TERM = {
  ...REMOVE_TERM_IDENTITY,
  input: {
    id: column('term', 'id', 'required'),
  },
  handler: removeTerm,
} satisfies CommandDefinition<RemoveTerm>;

/** Removes the term from its domain. */
export function removeTerm(tx: Transaction, input: RemoveTerm): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('term', input.id) ?? tx.refuse('missing', `there is no term ${input.id}`);
  domain.terms = domain.terms.filter((x) => x.row.id !== input.id);
  domains.save(domain);
}
