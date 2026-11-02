import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { toDomain } from '../../../platform/data/renames.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { RepositoryRow } from '../../../platform/data/tables.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { MOVE_REPOSITORY_IDENTITY } from './identities.generated.ts';

/** The repository and the domain it moves to. */
export type MoveRepository = Pick<RepositoryRow, 'id' | 'domain_id'>;

export const MOVE_REPOSITORY = {
  ...MOVE_REPOSITORY_IDENTITY,
  input: {
    id: column('repository', 'id', 'required'),
    domain_id: column('repository', 'domain_id', 'required'),
  },
  handler: moveRepository,
} satisfies CommandDefinition<MoveRepository>;

// The repository leaves its domain's instance with its new domain named, and the new IDs then carry it into the other.
export function moveRepository(tx: Transaction, input: MoveRepository): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('repository', input.id) ?? tx.refuse('missing', `there is no repository ${input.id}`);
  const at = domain.repositories.findIndex((x) => x.row.id === input.id);
  const renames = toDomain(tx, { id: input.id, label: 'repository', domainId: domain.root }, input.domain_id);
  domain.repositories[at] = { ...domain.repositories[at], row: { ...domain.repositories[at].row, domain_id: input.domain_id } };
  holdToRules(tx, domain);
  domains.save(domain);
  domains.carryRenames(renames);
}
