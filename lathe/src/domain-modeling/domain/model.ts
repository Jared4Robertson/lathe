// The Domain aggregate (LA-MOD-A4): a domain with its capabilities (and the business outcomes each serves), its terms
// (each with the terms it builds on), its domain services with the service that implements each and their tests, and
// its repositories (each with the aggregate it persists). Its technical records, the repositories and services, carry
// the standard rules they meet and the packages they use. One instance is one domain, whole; it holds only the links
// its own records start.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { CapabilityRow, DomainRow, DomainServiceRow, DomainServiceTestRow, RepositoryRow, ServiceRow, TermRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const DOMAIN_AGGREGATE = 'LA-MOD-A4';

/** A capability with the business outcomes it serves. */
export interface Capability {
  row: CapabilityRow;
  serves: string[];
}

/** A term with the terms its meaning builds on (builds_on), of any domain of the product. */
export interface Term {
  row: TermRow;
  buildsOn: string[];
}

/** A technical record with the standard rules it meets and the packages it uses. */
export interface Technical<T> {
  row: T;
  meets: string[];
  packages: string[];
  /** Its helper files (helper_file), sorted. */
  helpers: string[];
}

/** A repository with the one aggregate it persists and the data store it is stored in. */
export interface Repository extends Technical<RepositoryRow> {
  persists: string | null;
  storedIn: string | null;
}

/** A test with the test data sets it starts from. */
export interface Tested<T> {
  row: T;
  startsFrom: string[];
}

/** One domain, whole. */
export interface Domain {
  /** The domain's ID: the aggregate's root. */
  readonly root: string;
  domain: DomainRow;
  capabilities: Capability[];
  terms: Term[];
  domainServices: DomainServiceRow[];
  services: Technical<ServiceRow>[];
  domainServiceTests: Tested<DomainServiceTestRow>[];
  repositories: Repository[];
}

/** The tables the Domain aggregate keeps its rows in: its kinds, their parts, and the relations its records start. */
export const DOMAIN_TABLES = [
  'domain',
  'capability',
  'term',
  'domain_service',
  'service',
  'domain_service_test',
  'repository',
  'serves',
  'persists',
  'stored_in',
  'meets',
  'package_use', 'helper_file',
  'starts_from',
  'builds_on',
] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const DOMAIN_SHAPE = {
  domain: { at: 'domain' },
  capability: { at: 'capabilities', lists: { serves: 'serves' } },
  term: { at: 'terms', lists: { builds_on: 'buildsOn' } },
  domain_service: { at: 'domainServices' },
  service: { at: 'services', lists: { meets: 'meets', packages: 'packages', helpers: 'helpers' } },
  domain_service_test: { at: 'domainServiceTests', lists: { starts_from: 'startsFrom' } },
  repository: { at: 'repositories', lists: { meets: 'meets', packages: 'packages', helpers: 'helpers' }, links: { persists: 'persists', stored_in: 'storedIn' } },
} as const satisfies AggregateShape;

export type DomainKind = keyof typeof DOMAIN_SHAPE;

/** The domains in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function domainsFrom(rows: (table: string) => Row[], only?: string): Domain[] {
  const domains = rows('domain').filter((r) => only === undefined || r.id === only) as unknown as DomainRow[];
  if (!domains.length) return [];
  const ids = new Set(domains.map((d) => d.id));
  // Each table's rows by the domain they sit in, grouped once.
  const inDomain = <T extends { domain_id: string }>(table: string) => groupBy((rows(table) as unknown as T[]).filter((r) => ids.has(r.domain_id)), (r) => r.domain_id);
  const capabilitiesOf = inDomain<CapabilityRow>('capability');
  const termsOf = inDomain<TermRow>('term');
  const domainServicesOf = inDomain<DomainServiceRow>('domain_service');
  const repositoriesOf = inDomain<RepositoryRow>('repository');
  const serviceOf = new Map([...domainServicesOf.values()].flat().map((s) => [s.id, s.domain_id]));
  const servicesOf = groupBy((rows('service') as unknown as ServiceRow[]).filter((s) => serviceOf.has(s.domain_service_id)), (s) => serviceOf.get(s.domain_service_id));
  const testsOf = groupBy((rows('domain_service_test') as unknown as DomainServiceTestRow[]).filter((t) => serviceOf.has(t.domain_service_id)), (t) => serviceOf.get(t.domain_service_id));
  const [serves, persists, storedIn, meets, startsFrom, buildsOn] = ['serves', 'persists', 'stored_in', 'meets', 'starts_from', 'builds_on'].map((table) => bySource(rows(table)));
  const packages = bySource(rows('package_use'), 'record_id', 'package');
  const helpers = bySource(rows('helper_file'), 'record_id', 'file');
  const technical = <T extends { id: string }>(row: T): Technical<T> => ({ row, meets: groupOf(meets, row.id), packages: groupOf(packages, row.id), helpers: groupOf(helpers, row.id) });
  return domains.map((domain) => ({
    root: domain.id,
    domain,
    capabilities: groupOf(capabilitiesOf, domain.id).map((row) => ({ row, serves: groupOf(serves, row.id) })),
    terms: groupOf(termsOf, domain.id).map((row) => ({ row, buildsOn: groupOf(buildsOn, row.id) })),
    domainServices: groupOf(domainServicesOf, domain.id),
    services: groupOf(servicesOf, domain.id).map(technical),
    domainServiceTests: groupOf(testsOf, domain.id).map((row) => ({ row, startsFrom: groupOf(startsFrom, row.id) })),
    repositories: groupOf(repositoriesOf, domain.id).map((row) => ({
      ...technical(row),
      persists: groupOf(persists, row.id)[0] ?? null,
      storedIn: groupOf(storedIn, row.id)[0] ?? null,
    })),
  }));
}

const links = (source: string, ids: (string | null)[]): Row[] => ids.filter((id): id is string => id !== null).map((target) => ({ source_id: source, target_id: target }));

/** The instance's rows, by table. */
export function domainRows(domain: Domain): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  const technical = [...domain.services, ...domain.repositories];
  return new Map<string, Row[]>([
    ['domain', [asRow(domain.domain)]],
    ['capability', domain.capabilities.map((c) => asRow(c.row))],
    ['term', domain.terms.map((t) => asRow(t.row))],
    ['domain_service', domain.domainServices.map(asRow)],
    ['service', domain.services.map((s) => asRow(s.row))],
    ['domain_service_test', domain.domainServiceTests.map((t) => asRow(t.row))],
    ['repository', domain.repositories.map((r) => asRow(r.row))],
    ['serves', domain.capabilities.flatMap((c) => links(c.row.id, c.serves))],
    ['persists', domain.repositories.flatMap((r) => links(r.row.id, [r.persists]))],
    ['stored_in', domain.repositories.flatMap((r) => links(r.row.id, [r.storedIn]))],
    ['meets', technical.flatMap((t) => links(t.row.id, t.meets))],
    ['package_use', technical.flatMap((t) => t.packages.map((name) => ({ record_id: t.row.id, package: name })))],
    ['helper_file', technical.flatMap((t) => t.helpers.map((name) => ({ record_id: t.row.id, file: name })))],
    ['starts_from', domain.domainServiceTests.flatMap((t) => links(t.row.id, t.startsFrom))],
    ['builds_on', domain.terms.flatMap((t) => links(t.row.id, t.buildsOn))],
  ]);
}

