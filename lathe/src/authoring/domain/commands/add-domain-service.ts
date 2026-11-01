import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DomainServiceRow } from '../../../platform/data/tables.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_DOMAIN_SERVICE_IDENTITY } from './identities.generated.ts';

/** A new domain service. */
export type AddDomainService = Pick<DomainServiceRow, 'id' | 'title' | 'domain_id' | 'statement'>;

export const ADD_DOMAIN_SERVICE = {
  ...ADD_DOMAIN_SERVICE_IDENTITY,
  input: {
    id: column('domain_service', 'id', 'required'),
    title: column('domain_service', 'title', 'required'),
    domain_id: column('domain_service', 'domain_id', 'required'),
    statement: column('domain_service', 'statement', 'required'),
  },
  handler: addDomainService,
} satisfies CommandDefinition<AddDomainService>;

/** Adds the domain service to its domain. */
export function addDomainService(tx: Transaction, input: AddDomainService): void {
  const domains = new DomainRepository(tx);
  const domain = domains.load(input.domain_id) ?? tx.refuse('missing', `there is no domain ${input.domain_id}`);
  domain.domainServices.push(input);
  holdToRules(tx, domain);
  domains.save(domain);
}
