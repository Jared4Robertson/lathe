import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DomainRepository } from '../repository.ts';
import { REMOVE_DOMAIN_IDENTITY } from './identities.generated.ts';

/** The domain to remove. */
export type RemoveDomain = { id: string };

export const REMOVE_DOMAIN: CommandDefinition<RemoveDomain> = {
  ...REMOVE_DOMAIN_IDENTITY,
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
