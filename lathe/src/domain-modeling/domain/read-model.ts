// The Domain aggregate's read model (LA-MOD-RM24), shaped for its readers: the Domain page reads a domain whole (its
// use cases by group, each group its use cases' result's aggregate or read model; its terms bottom-up, each with the terms
// it builds on; its domain services, each with its service and tests; its repositories, each with the aggregate it
// persists) with the record the page is about, a product's list reads each domain's ID and title, and the editor's
// next ID reads the IDs in use. The projection (domainTableFrom) is the only code that reads the source rows and the
// only code that writes the read model's table; the query handlers read that table only through the reader
// (reader.ts). Nothing here is the aggregate's own instance type. termsBottomUp is the one order every glossary list
// shows terms in, the app's included.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { DomainRow, DomainServiceRow, DomainServiceTestRow, RepositoryRow, ServiceRow, TermRow } from '../../platform/data/tables.ts';
import type { DomainKind } from './model.ts';
import { domainOrder } from '../../platform/data/domain-order.ts';
import { byRecordId, compareIds } from '../../platform/data/ids.ts';
import { compareGroups, placementOf, useCaseGroupOf, type UseCaseGroup } from '../../exploring/placement.ts';

/** A group of the domain's use cases as the page shows it: the aggregate or read model they sit with, and their IDs in ID order. */
export interface UseCasesOfGroup {
  group: UseCaseGroup;
  useCases: string[];
}

/** A service as the page shows it: its row, the standard rules it meets and the packages it uses. */
export interface ServiceOnPage {
  service: ServiceRow;
  meets: string[];
  packages: string[];
  /** Its helper files, sorted. */
  helpers: string[];
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

/** A repository as the page shows it: its row, the one aggregate it persists, the standard rules it meets and the packages it uses. */
export interface RepositoryOnPage {
  repository: RepositoryRow;
  persists: string | null;
  meets: string[];
  packages: string[];
  /** Its helper files, sorted. */
  helpers: string[];
}

/** A term as the page shows it: its row and the terms its meaning builds on, by ID. */
export interface TermOnPage {
  term: TermRow;
  buildsOn: string[];
}

/** A domain whole, as its page shows it. */
export interface DomainTree {
  domain: DomainRow;
  /** Its use cases by group: aggregates by ID, then read models by ID, and the use cases of each by ID. */
  useCases: UseCasesOfGroup[];
  /** Its terms, bottom-up: each after every term it builds on (termsBottomUp). */
  terms: TermOnPage[];
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
  /** Each product's domains, by position; a product with none has an empty list. */
  products: Map<string, DomainSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

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

/**
 * Terms bottom-up, as every glossary lists them: each after everything it builds on, through any chain, and otherwise
 * by title (then ID). `buildsOn` gives the targets of a term's builds_on links, of any domain; a link to a term not
 * listed still orders through that term's own links. A loop (which the rules refuse) is broken at its lowest title.
 */
export function termsBottomUp<T extends { id: string; title: string }>(terms: readonly T[], buildsOn: (id: string) => readonly string[]): T[] {
  const byTitle = (a: T, b: T) => a.title.localeCompare(b.title, 'en') || byRecordId(a, b);
  // The listed terms each one builds on, through any chain of links (listed or not).
  const listed = new Set(terms.map((t) => t.id));
  const below = (id: string): Set<string> => {
    const found = new Set<string>();
    const seen = new Set<string>([id]);
    const walk = (from: string) => {
      for (const to of buildsOn(from)) {
        if (seen.has(to)) continue;
        seen.add(to);
        if (listed.has(to)) found.add(to);
        walk(to);
      }
    };
    walk(id);
    return found;
  };
  const waiting = new Map(terms.map((t) => [t.id, below(t.id)]));
  const out: T[] = [];
  const left = [...terms].sort(byTitle);
  while (left.length) {
    const at = left.findIndex((t) => [...waiting.get(t.id)!].every((id) => !left.some((l) => l.id === id)));
    const [next] = left.splice(at === -1 ? 0 : at, 1);
    out.push(next);
  }
  return out;
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function domainTableFrom(view: ReadView): DomainTable {
  const [persists, meets, startsFrom, buildsOn] = ['persists', 'meets', 'starts_from', 'builds_on'].map((t) => targets(view, t));
  const packages = targets(view, 'package_use', 'record_id', 'package');
  const helpers = targets(view, 'helper_file', 'record_id', 'file');
  const useCases = grouped<{ id: string }>(view.rows('use_case'), 'domain_id');
  const placed = placementOf(view);
  const byGroup = (ids: readonly { id: string }[]): UseCasesOfGroup[] => {
    const groups = new Map<string, UseCasesOfGroup>();
    for (const { id } of ids) {
      const group = useCaseGroupOf(placed, id);
      if (!group) continue;
      const at = groups.get(group.id) ?? { group, useCases: [] };
      at.useCases.push(id);
      groups.set(group.id, at);
    }
    return [...groups.values()].sort((a, b) => compareGroups(a.group, b.group)).map((g) => ({ ...g, useCases: g.useCases.sort(compareIds) }));
  };
  const terms = grouped<TermRow>(view.rows('term'), 'domain_id');
  const domainServices = grouped<DomainServiceRow>(view.rows('domain_service'), 'domain_id');
  const services = grouped<ServiceRow>(view.rows('service'), 'domain_service_id');
  const tests = grouped<DomainServiceTestRow>(view.rows('domain_service_test'), 'domain_service_id');
  const repositories = grouped<RepositoryRow>(view.rows('repository'), 'domain_id');

  const domains = new Map<string, DomainTree>();
  const holding = new Map<string, { root: string; kind: DomainKind }>();
  const products = new Map<string, DomainSummary[]>(view.rows('product').map((p) => [String(p.id), []]));
  for (const domain of view.rows('domain') as unknown as DomainRow[]) {
    const root = domain.id;
    const hold = (id: string, kind: DomainKind) => holding.set(id, { root, kind });
    hold(root, 'domain');
    const tree: DomainTree = {
      domain,
      useCases: byGroup(useCases.get(root) ?? []),
      terms: termsBottomUp(terms.get(root) ?? [], buildsOn).map((term) => ({ term, buildsOn: buildsOn(term.id) })),
      domainServices: [...(domainServices.get(root) ?? [])].sort(byRecordId).map((domainService) => {
        const service = (services.get(domainService.id) ?? [])[0];
        return {
          domainService,
          service: service ? { service, meets: meets(service.id), packages: packages(service.id), helpers: helpers(service.id) } : null,
          tests: [...(tests.get(domainService.id) ?? [])].sort(byRecordId).map((test) => ({ test, startsFrom: startsFrom(test.id) })),
        };
      }),
      repositories: [...(repositories.get(root) ?? [])].sort(byRecordId).map((repository) => ({
        repository,
        persists: persists(repository.id)[0] ?? null,
        meets: meets(repository.id),
        packages: packages(repository.id),
        helpers: helpers(repository.id),
      })),
    };
    for (const t of tree.terms) hold(t.term.id, 'term');
    for (const s of tree.domainServices) {
      hold(s.domainService.id, 'domain_service');
      if (s.service) hold(s.service.service.id, 'service');
      for (const t of s.tests) hold(t.test.id, 'domain_service_test');
    }
    for (const r of tree.repositories) hold(r.repository.id, 'repository');
    domains.set(root, tree);
    products.get(domain.product_id)?.push({ id: domain.id, title: domain.title });
  }
  const place = domainOrder(view.rows('domain'));
  for (const list of products.values()) list.sort((a, b) => place.get(a.id)! - place.get(b.id)!);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { domains, holding, products, kinds };
}
