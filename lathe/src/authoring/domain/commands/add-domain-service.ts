// Add a domain service (LA-AUT-CMD169): Adds a domain service to its domain, with what it must work out.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DomainServiceRow } from '../../../platform/data/tables.ts';
import { DOMAIN_SLICE } from '../model.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new domain service. */
export type AddDomainService = Pick<DomainServiceRow, 'id' | 'title' | 'domain_id' | 'statement'>;

/** Add a domain service (LA-AUT-CMD169). */
export const ADD_DOMAIN_SERVICE: CommandDefinition<AddDomainService> = {
  id: 'LA-AUT-CMD169',
  slice: DOMAIN_SLICE,
  name: 'add-domain-service',
  description: 'Adds a domain service to its domain, with what it must work out.',
  method: 'POST',
  route: '/api/domain/add-domain-service',
  input: {
    id: column('domain_service', 'id', 'required'),
    title: column('domain_service', 'title', 'required'),
    domain_id: column('domain_service', 'domain_id', 'required'),
    statement: column('domain_service', 'statement', 'required'),
  },
  handler: addDomainService,
};

/** Adds the domain service to its domain. */
export function addDomainService(tx: Transaction, input: AddDomainService): void {
  const domains = new DomainRepository(tx);
  const domain = domains.load(input.domain_id) ?? tx.refuse('missing', `there is no domain ${input.domain_id}`);
  domain.domainServices.push(input);
  holdToRules(tx, domain);
  domains.save(domain);
}
