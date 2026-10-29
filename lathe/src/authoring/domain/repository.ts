// DomainRepository (LA-AUT-REPO04): loads and saves the Domain aggregate whole, in its own tables only. A record inside
// a domain (a capability, term, domain service, service, domain service test or repository) is reached through the
// domain that holds it.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { DOMAIN_KINDS, DOMAIN_TABLES, domainRows, domainsFrom, kindInside, type Domain, type DomainKind } from './model.ts';

export class DomainRepository extends AggregateRepository<Domain> {
  constructor(tx: Transaction) {
    super(tx, 'DomainRepository', DOMAIN_TABLES);
  }

  protected read(rootId: string): Domain | undefined {
    return domainsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(domain: Domain): InstanceRows {
    return domainRows(domain);
  }

  /**
   * Loads the domain that holds the record of the kind with this ID: the domain itself, or the domain of the record,
   * found up its parents inside the aggregate. Undefined when there is no such record.
   */
  loadHolding(kind: DomainKind, id: string): Domain | undefined {
    let at: { kind: DomainKind; id: string } = { kind, id };
    for (;;) {
      const row = this.files.find(at.kind, { id: at.id });
      if (!row) return undefined;
      if (at.kind === 'domain') break;
      const column = DOMAIN_KINDS[at.kind];
      at = { kind: column === 'domain_id' ? 'domain' : 'domain_service', id: String(row[column]) };
    }
    const domain = this.load(at.id);
    return domain && kindInside(domain, id) === kind ? domain : undefined;
  }
}
