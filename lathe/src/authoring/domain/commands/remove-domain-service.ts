import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DomainRepository } from '../repository.ts';
import { REMOVE_DOMAIN_SERVICE_IDENTITY } from './identities.generated.ts';

/** The domain service to remove. */
export type RemoveDomainService = { id: string };

export const REMOVE_DOMAIN_SERVICE: CommandDefinition<RemoveDomainService> = {
  ...REMOVE_DOMAIN_SERVICE_IDENTITY,
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
