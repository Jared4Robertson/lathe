import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DOMAIN_SLICE } from '../model.ts';
import { DomainRepository } from '../repository.ts';

/** The repository to remove. */
export type RemoveRepository = { id: string };

export const REMOVE_REPOSITORY: CommandDefinition<RemoveRepository> = {
  id: 'LA-AUT-CMD174',
  slice: DOMAIN_SLICE,
  name: 'remove-repository',
  description: 'Removes a repository with the links it starts and the packages it uses. Refused while anything references it.',
  method: 'POST',
  route: '/api/domain/remove-repository',
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
