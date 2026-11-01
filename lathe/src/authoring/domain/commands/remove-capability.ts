import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DomainRepository } from '../repository.ts';
import { REMOVE_CAPABILITY_IDENTITY } from './identities.generated.ts';

/** The capability to remove. */
export type RemoveCapability = { id: string };

export const REMOVE_CAPABILITY: CommandDefinition<RemoveCapability> = {
  ...REMOVE_CAPABILITY_IDENTITY,
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
