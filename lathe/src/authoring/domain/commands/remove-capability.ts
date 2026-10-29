// Remove a capability (LA-AUT-CMD165): Removes a capability and the links it starts. Refused while a use case sits under it or anything else references it.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DOMAIN_SLICE } from '../model.ts';
import { DomainRepository } from '../repository.ts';

/** The capability to remove. */
export type RemoveCapability = { id: string };

/** Remove a capability (LA-AUT-CMD165). */
export const REMOVE_CAPABILITY: CommandDefinition<RemoveCapability> = {
  id: 'LA-AUT-CMD165',
  slice: DOMAIN_SLICE,
  name: 'remove-capability',
  description: 'Removes a capability and the links it starts. Refused while a use case sits under it or anything else references it.',
  method: 'POST',
  route: '/api/domain/remove-capability',
  input: {
    id: column('capability', 'id', 'required'),
  },
  handler: removeCapability,
};

/** Removes the capability from its domain. */
export function removeCapability(tx: Transaction, input: RemoveCapability): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('capability', input.id) ?? tx.refuse('missing', `there is no capability ${input.id}`);
  domain.capabilities = domain.capabilities.filter((x) => x.row.id !== input.id);
  domains.save(domain);
}
