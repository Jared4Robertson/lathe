import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DOMAIN_SLICE } from '../model.ts';
import { DomainRepository } from '../repository.ts';

/** The domain to remove. */
export type RemoveDomain = { id: string };

export const REMOVE_DOMAIN: CommandDefinition<RemoveDomain> = {
  id: 'LA-AUT-CMD162',
  slice: DOMAIN_SLICE,
  name: 'remove-domain',
  description: 'Removes a domain whole: its capabilities, terms, domain services with their services and tests, repositories, and the links they start. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/domain/remove-domain',
  input: {
    id: column('domain', 'id', 'required'),
  },
  handler: removeDomain,
};

/** Removes the domain whole. */
export function removeDomain(tx: Transaction, input: RemoveDomain): void {
  const domains = new DomainRepository(tx);
  const domain = domains.load(input.id) ?? tx.refuse('missing', `there is no domain ${input.id}`);
  domains.remove(domain);
}
