import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DomainRepository } from '../repository.ts';
import { REMOVE_REPOSITORY_IDENTITY } from './identities.generated.ts';

/** The repository to remove. */
export type RemoveRepository = { id: string };

export const REMOVE_REPOSITORY: CommandDefinition<RemoveRepository> = {
  ...REMOVE_REPOSITORY_IDENTITY,
  input: {
    id: column('repository', 'id', 'required'),
  },
  handler: removeRepository,
};

/** Removes the repository from its domain. */
export function removeRepository(tx: Transaction, input: RemoveRepository): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('repository', input.id) ?? tx.refuse('missing', `there is no repository ${input.id}`);
  domain.repositories = domain.repositories.filter((x) => x.row.id !== input.id);
  domains.save(domain);
}
