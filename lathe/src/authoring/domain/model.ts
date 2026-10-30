// The Domain aggregate (LA-AUT-A4): a domain with its capabilities (and the business outcomes each serves), its terms
// (each with the terms it builds on), its domain services with the service that implements each and their tests, and
// its repositories (each with the aggregate it persists). Its technical records, the repositories and services, carry
// the standard rules they meet and the packages they use. One instance is one domain, whole; it holds only the links
// its own records start.
import type { Slice } from '../../platform/commands/definition.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { CapabilityRow, DomainRow, DomainServiceRow, DomainServiceTestRow, RepositoryRow, ServiceRow, TermRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const DOMAIN_AGGREGATE = 'LA-AUT-A4';

/** How the interfaces reach the aggregate's commands: `lathe domain`, the domain_ tools, /api/domain/. */
export const DOMAIN_SLICE: Slice = { aggregate: DOMAIN_AGGREGATE, name: 'domain' };

/**
 * The row with the changes applied: a value sets its column, null clears it, and a column left out keeps its value.
 * Only the columns named in `columns` are taken from the changes.
 */
export function changed<R extends object>(row: R, changes: object, columns: readonly string[]): R {
  const next = { ...row } as Record<string, unknown>;
  for (const [column, value] of Object.entries(changes)) {
    if (!columns.includes(column) || value === undefined) continue;
    if (value === null) delete next[column];
    else next[column] = value as Value;
  }
  return next as R;
}

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
  'package_use',
  'starts_from',
  'builds_on',
] as const;

/** The kinds of the aggregate's records, each with the column that names its parent inside the aggregate. */
export const DOMAIN_KINDS = {
  domain: null,
  capability: 'domain_id',
  term: 'domain_id',
  domain_service: 'domain_id',
  repository: 'domain_id',
  service: 'domain_service_id',
  domain_service_test: 'domain_service_id',
} as const;

export type DomainKind = keyof typeof DOMAIN_KINDS;

/** A new domain, with nothing under it yet. */
export function newDomain(domain: DomainRow): Domain {
  return { root: domain.id, domain, capabilities: [], terms: [], domainServices: [], services: [], domainServiceTests: [], repositories: [] };
}

// A link table's targets by source, each list sorted.
function bySource(links: Row[], source = 'source_id', target = 'target_id'): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const l of links) found.set(String(l[source]), [...(found.get(String(l[source])) ?? []), String(l[target])]);
  for (const list of found.values()) list.sort();
  return found;
}

/** The domains in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function domainsFrom(rows: (table: string) => Row[], only?: string): Domain[] {
  const domains = rows('domain').filter((r) => only === undefined || r.id === only) as unknown as DomainRow[];
  if (!domains.length) return [];
  const ids = new Set(domains.map((d) => d.id));
  const inDomain = <T extends { domain_id: string }>(table: string) => (rows(table) as unknown as T[]).filter((r) => ids.has(r.domain_id));
  const capabilities = inDomain<CapabilityRow>('capability');
  const terms = inDomain<TermRow>('term');
  const domainServices = inDomain<DomainServiceRow>('domain_service');
  const repositories = inDomain<RepositoryRow>('repository');
  const serviceOf = new Map(domainServices.map((s) => [s.id, s.domain_id]));
  const services = (rows('service') as unknown as ServiceRow[]).filter((s) => serviceOf.has(s.domain_service_id));
  const tests = (rows('domain_service_test') as unknown as DomainServiceTestRow[]).filter((t) => serviceOf.has(t.domain_service_id));
  const [serves, persists, storedIn, meets, startsFrom, buildsOn] = ['serves', 'persists', 'stored_in', 'meets', 'starts_from', 'builds_on'].map((table) => bySource(rows(table)));
  const packages = bySource(rows('package_use'), 'record_id', 'package');
  const targets = (links: Map<string, string[]>, source: string) => links.get(source) ?? [];
  const technical = <T extends { id: string }>(row: T): Technical<T> => ({ row, meets: targets(meets, row.id), packages: targets(packages, row.id) });
  return domains.map((domain) => {
    const own = (r: { domain_id: string }) => r.domain_id === domain.id;
    const ownServices = (r: { domain_service_id: string }) => serviceOf.get(r.domain_service_id) === domain.id;
    return {
      root: domain.id,
      domain,
      capabilities: capabilities.filter(own).map((row) => ({ row, serves: targets(serves, row.id) })),
      terms: terms.filter(own).map((row) => ({ row, buildsOn: targets(buildsOn, row.id) })),
      domainServices: domainServices.filter(own),
      services: services.filter(ownServices).map(technical),
      domainServiceTests: tests.filter(ownServices).map((row) => ({ row, startsFrom: targets(startsFrom, row.id) })),
      repositories: repositories.filter(own).map((row) => ({
        ...technical(row),
        persists: targets(persists, row.id)[0] ?? null,
        storedIn: targets(storedIn, row.id)[0] ?? null,
      })),
    };
  });
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
    ['starts_from', domain.domainServiceTests.flatMap((t) => links(t.row.id, t.startsFrom))],
    ['builds_on', domain.terms.flatMap((t) => links(t.row.id, t.buildsOn))],
  ]);
}

/** The kind of the record with this ID inside the domain, or undefined. */
export function kindInside(domain: Domain, id: string): DomainKind | undefined {
  if (domain.root === id) return 'domain';
  if (domain.capabilities.some((c) => c.row.id === id)) return 'capability';
  if (domain.terms.some((t) => t.row.id === id)) return 'term';
  if (domain.domainServices.some((s) => s.id === id)) return 'domain_service';
  if (domain.repositories.some((r) => r.row.id === id)) return 'repository';
  if (domain.services.some((s) => s.row.id === id)) return 'service';
  if (domain.domainServiceTests.some((t) => t.row.id === id)) return 'domain_service_test';
  return undefined;
}
