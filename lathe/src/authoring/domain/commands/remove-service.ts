import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DomainRepository } from '../repository.ts';
import { REMOVE_SERVICE_IDENTITY } from './identities.generated.ts';

/** The service to remove. */
export type RemoveService = { id: string };

export const REMOVE_SERVICE = {
  ...REMOVE_SERVICE_IDENTITY,
  input: {
    id: column('service', 'id', 'required'),
  },
  handler: removeService,
} satisfies CommandDefinition<RemoveService>;

/** Removes the service from its domain service. */
export function removeService(tx: Transaction, input: RemoveService): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('service', input.id) ?? tx.refuse('missing', `there is no service ${input.id}`);
  domain.services = domain.services.filter((x) => x.row.id !== input.id);
  domains.save(domain);
}
