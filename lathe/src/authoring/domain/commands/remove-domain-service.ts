// Remove a domain service (LA-AUT-CMD171): Removes a domain service with its service and tests and the links they start. Refused while a command or query calls it, or anything else references it or them.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DOMAIN_SLICE } from '../model.ts';
import { DomainRepository } from '../repository.ts';

/** The domain service to remove. */
export type RemoveDomainService = { id: string };

/** Remove a domain service (LA-AUT-CMD171). */
export const REMOVE_DOMAIN_SERVICE: CommandDefinition<RemoveDomainService> = {
  id: 'LA-AUT-CMD171',
  slice: DOMAIN_SLICE,
  name: 'remove-domain-service',
  description: 'Removes a domain service with its service and tests and the links they start. Refused while a command or query calls it, or anything else references it or them.',
  method: 'POST',
  route: '/api/domain/remove-domain-service',
  input: {
    id: column('domain_service', 'id', 'required'),
  },
  handler: removeDomainService,
};

/** Removes the domain service, its service and its tests from its domain. */
export function removeDomainService(tx: Transaction, input: RemoveDomainService): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('domain_service', input.id) ?? tx.refuse('missing', `there is no domain service ${input.id}`);
  domain.domainServices = domain.domainServices.filter((s) => s.id !== input.id);
  domain.services = domain.services.filter((s) => s.row.domain_service_id !== input.id);
  domain.domainServiceTests = domain.domainServiceTests.filter((t) => t.row.domain_service_id !== input.id);
  domains.save(domain);
}
