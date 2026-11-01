import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DomainServiceRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_DOMAIN_SERVICE_IDENTITY } from './identities.generated.ts';

/** The domain service's changes: a column given is set. */
export type ChangeDomainService = Pick<DomainServiceRow, 'id'> & { title?: DomainServiceRow['title']; statement?: DomainServiceRow['statement'] };

export const CHANGE_DOMAIN_SERVICE: CommandDefinition<ChangeDomainService> = {
  ...CHANGE_DOMAIN_SERVICE_IDENTITY,
  input: {
    id: column('domain_service', 'id', 'required'),
    title: column('domain_service', 'title', 'optional'),
    statement: column('domain_service', 'statement', 'optional'),
  },
  handler: changeDomainService,
};

/** Changes the domain service's columns. */
export function changeDomainService(tx: Transaction, input: ChangeDomainService): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('domain_service', input.id) ?? tx.refuse('missing', `there is no domain service ${input.id}`);
  domain.domainServices = domain.domainServices.map((s) => (s.id === input.id ? changed(s, input, ['title', 'statement']) : s));
  holdToRules(tx, domain);
  domains.save(domain);
}
