// The Domain aggregate's read model (LA-AUT-RM24), shaped for its readers: the Domain page reads a domain whole (its
// capabilities in order, each with the outcomes it serves and its use cases; its terms; its domain services, each with
// its service and tests; its repositories, each with the aggregate it persists) with the record the page is about, a
// product's list reads each domain's ID and title, and the editor's next ID reads the IDs in use. The projection
// (domainTableFrom) is the only code that reads the source rows and the only code that writes the read model's table;
// the query handlers read that table only through the reader (reader.ts). Nothing here is the aggregate's own
// instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { CapabilityRow, DomainRow, DomainServiceRow, DomainServiceTestRow, RepositoryRow, RepositoryShareRow, ServiceRow, TermRow } from '../../platform/data/tables.ts';
import type { DomainKind } from './model.ts';

/** A capability as the page shows it: its row, the business outcomes it serves, and its use cases by ID. */
export interface CapabilityOnPage {
  capability: CapabilityRow;
  serves: string[];
  useCases: string[];
}

/** A service as the page shows it: its row, the standard rules it meets and the packages it uses. */
export interface ServiceOnPage {
  service: ServiceRow;
  meets: string[];
  packages: string[];
}

/** A domain service test as the page shows it: its row and the test data sets it starts from. */
export interface DomainServiceTestOnPage {
  test: DomainServiceTestRow;
  startsFrom: string[];
}

/** A domain service as the page shows it: its row, the service that implements it, and its tests by ID. */
export interface DomainServiceOnPage {
  domainService: DomainServiceRow;
  service: ServiceOnPage | null;
  tests: DomainServiceTestOnPage[];
}

/** A repository as the page shows it: its row, the aggregate it persists (and the others it also persists, each with its reason), the standard rules it meets and the packages it uses. */
export interface RepositoryOnPage {
  repository: RepositoryRow;
  persists: string | null;
  alsoPersists: { aggregate: string; reason: string }[];
  meets: string[];
  packages: string[];
}

/** A domain whole, as its page shows it. */
export interface DomainTree {
  domain: DomainRow;
  /** Its capabilities, by position, then ID. */
  capabilities: CapabilityOnPage[];
  /** Its terms, by ID. */
  terms: TermRow[];
  /** Its domain services, by ID. */
  domainServices: DomainServiceOnPage[];
  /** Its repositories, by ID. */
  repositories: RepositoryOnPage[];
}

/** A domain as its page reads it, with the record of it the page is about. */
export interface DomainPage extends DomainTree {
  record: { id: string; kind: DomainKind };
}

/** A domain as a product's list reads it. */
export interface DomainSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface DomainTable {
  /** Each domain whole, by its ID. */
  domains: Map<string, DomainTree>;
  /** Each record inside a domain: the domain that holds it and its kind there. */
  holding: Map<string, { root: string; kind: DomainKind }>;
  /** Each product's domains, by ID; a product with none has an empty list. */
  products: Map<string, DomainSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, 'en', { numeric: true });

/** Rows by a column's value, each list in the table's order. */
function grouped<T>(rows: Row[], column: string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) found.set(String(r[column]), [...(found.get(String(r[column])) ?? []), r as unknown as T]);
  return found;
}

/** A link table's targets by source, each list sorted. */
function targets(view: ReadView, table: string, source = 'source_id', target = 'target_id'): (id: string) => string[] {
  const bySource = grouped<Row>(view.rows(table), source);
  return (id) => (bySource.get(id) ?? []).map((l) => String(l[target])).sort();
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function domainTableFrom(view: ReadView): DomainTable {
  const [serves, persists, meets, startsFrom] = ['serves', 'persists', 'meets', 'starts_from'].map((t) => targets(view, t));
  const packages = targets(view, 'package_use', 'record_id', 'package');
  const capabilities = grouped<CapabilityRow>(view.rows('capability'), 'domain_id');
  const useCases = grouped<{ id: string }>(view.rows('use_case'), 'capability_id');
  const terms = grouped<TermRow>(view.rows('term'), 'domain_id');
  const domainServices = grouped<DomainServiceRow>(view.rows('domain_service'), 'domain_id');
  const services = grouped<ServiceRow>(view.rows('service'), 'domain_service_id');
  const tests = grouped<DomainServiceTestRow>(view.rows('domain_service_test'), 'domain_service_id');
  const repositories = grouped<RepositoryRow>(view.rows('repository'), 'domain_id');
  const shares = grouped<RepositoryShareRow>(view.rows('repository_share'), 'repository_id');

  const domains = new Map<string, DomainTree>();
  const holding = new Map<string, { root: string; kind: DomainKind }>();
  const products = new Map<string, DomainSummary[]>(view.rows('product').map((p) => [String(p.id), []]));
  for (const domain of view.rows('domain') as unknown as DomainRow[]) {
    const root = domain.id;
    const hold = (id: string, kind: DomainKind) => holding.set(id, { root, kind });
    hold(root, 'domain');
    const tree: DomainTree = {
      domain,
      capabilities: [...(capabilities.get(root) ?? [])]
        .sort((a, b) => a.position - b.position || byId(a, b))
        .map((capability) => ({ capability, serves: serves(capability.id), useCases: (useCases.get(capability.id) ?? []).map((u) => u.id).sort() })),
      terms: [...(terms.get(root) ?? [])].sort(byId),
      domainServices: [...(domainServices.get(root) ?? [])].sort(byId).map((domainService) => {
        const service = (services.get(domainService.id) ?? [])[0];
        return {
          domainService,
          service: service ? { service, meets: meets(service.id), packages: packages(service.id) } : null,
          tests: [...(tests.get(domainService.id) ?? [])].sort(byId).map((test) => ({ test, startsFrom: startsFrom(test.id) })),
        };
      }),
      repositories: [...(repositories.get(root) ?? [])].sort(byId).map((repository) => ({
        repository,
        persists: persists(repository.id)[0] ?? null,
        alsoPersists: (shares.get(repository.id) ?? []).map((s) => ({ aggregate: s.aggregate_id, reason: s.reason })).sort((a, b) => a.aggregate.localeCompare(b.aggregate)),
        meets: meets(repository.id),
        packages: packages(repository.id),
      })),
    };
    for (const c of tree.capabilities) hold(c.capability.id, 'capability');
    for (const t of tree.terms) hold(t.id, 'term');
    for (const s of tree.domainServices) {
      hold(s.domainService.id, 'domain_service');
      if (s.service) hold(s.service.service.id, 'service');
      for (const t of s.tests) hold(t.test.id, 'domain_service_test');
    }
    for (const r of tree.repositories) hold(r.repository.id, 'repository');
    domains.set(root, tree);
    products.get(domain.product_id)?.push({ id: domain.id, title: domain.title });
  }
  for (const list of products.values()) list.sort(byId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { domains, holding, products, kinds };
}
