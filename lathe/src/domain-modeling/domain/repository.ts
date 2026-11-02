// Generated from data/ by `npm run generate`. Do not edit.
// DomainRepository (LA-MOD-REPO04): Loads a domain whole from the transaction's draft (its capabilities with what they
// serve, terms, domain services with their services and tests, and repositories with what they persist, meet and use)
// and saves exactly the rows that changed, in the Domain aggregate's own tables only; a write to any other table is
// refused when it is made (`DataFiles`). A record inside a domain is loaded through the domain that holds it
// (`loadHolding`), and a removal is refused, naming the referrers, while anything outside references what goes.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { DOMAIN_TABLES, domainRows, domainsFrom, type Domain, type DomainKind } from './model.ts';

export class DomainRepository extends Repository<Domain> {
  constructor(tx: Transaction) {
    super(tx, 'DomainRepository', DOMAIN_TABLES);
  }

  protected read(rootId: string): Domain | undefined {
    return domainsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(domain: Domain): InstanceRows {
    return domainRows(domain);
  }

  /** Loads the domain that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: DomainKind, id: string): Domain | undefined {
    const root = this.rootOf(kind, id);
    const domain = root === undefined ? undefined : this.load(root);
    return domain && holds(domain, kind, id) ? domain : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: DomainKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'domain': return id;
      case 'capability': return this.rootOf('domain', String(row.domain_id));
      case 'term': return this.rootOf('domain', String(row.domain_id));
      case 'domain_service': return this.rootOf('domain', String(row.domain_id));
      case 'service': return this.rootOf('domain_service', String(row.domain_service_id));
      case 'domain_service_test': return this.rootOf('domain_service', String(row.domain_service_id));
      case 'repository': return this.rootOf('domain', String(row.domain_id));
    }
  }
}

/** Whether the domain holds the record of the kind with this ID. */
function holds(domain: Domain, kind: DomainKind, id: string): boolean {
  switch (kind) {
    case 'domain': return domain.root === id;
    case 'capability': return domain.capabilities.some((x) => x.row.id === id);
    case 'term': return domain.terms.some((x) => x.row.id === id);
    case 'domain_service': return domain.domainServices.some((x) => x.id === id);
    case 'service': return domain.services.some((x) => x.row.id === id);
    case 'domain_service_test': return domain.domainServiceTests.some((x) => x.row.id === id);
    case 'repository': return domain.repositories.some((x) => x.row.id === id);
  }
}
