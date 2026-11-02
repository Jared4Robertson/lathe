import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { toDomain } from '../../../platform/data/renames.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DomainServiceRow } from '../../../platform/data/tables.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { MOVE_DOMAIN_SERVICE_IDENTITY } from './identities.generated.ts';

/** The domain service and the domain it moves to. */
export type MoveDomainService = Pick<DomainServiceRow, 'id' | 'domain_id'>;

export const MOVE_DOMAIN_SERVICE = {
  ...MOVE_DOMAIN_SERVICE_IDENTITY,
  input: {
    id: column('domain_service', 'id', 'required'),
    domain_id: column('domain_service', 'domain_id', 'required'),
  },
  handler: moveDomainService,
} satisfies CommandDefinition<MoveDomainService>;

// The domain service leaves its domain's instance with its new domain named, and the new IDs then carry it into the other.
export function moveDomainService(tx: Transaction, input: MoveDomainService): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('domain_service', input.id) ?? tx.refuse('missing', `there is no domain service ${input.id}`);
  const renames = toDomain(tx, { id: input.id, label: 'domain service', domainId: domain.root }, input.domain_id);
  domain.domainServices = domain.domainServices.map((x) => (x.id === input.id ? { ...x, domain_id: input.domain_id } : x));
  holdToRules(tx, domain);
  domains.save(domain);
  domains.carryRenames(renames);
}
