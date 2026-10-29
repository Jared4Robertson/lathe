// Remove a service (LA-AUT-CMD177): Removes a service with the links it starts and the packages it uses. Refused while anything references it.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DOMAIN_SLICE } from '../model.ts';
import { DomainRepository } from '../repository.ts';

/** The service to remove. */
export type RemoveService = { id: string };

/** Remove a service (LA-AUT-CMD177). */
export const REMOVE_SERVICE: CommandDefinition<RemoveService> = {
  id: 'LA-AUT-CMD177',
  slice: DOMAIN_SLICE,
  name: 'remove-service',
  description: 'Removes a service with the links it starts and the packages it uses. Refused while anything references it.',
  method: 'POST',
  route: '/api/domain/remove-service',
  input: {
    id: column('service', 'id', 'required'),
  },
  handler: removeService,
};

/** Removes the service from its domain service. */
export function removeService(tx: Transaction, input: RemoveService): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('service', input.id) ?? tx.refuse('missing', `there is no service ${input.id}`);
  domain.services = domain.services.filter((x) => x.row.id !== input.id);
  domains.save(domain);
}
