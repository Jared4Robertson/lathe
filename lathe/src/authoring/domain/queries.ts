// The Domain aggregate's own reads (read model LA-AUT-RM24): a domain whole, the domains of a product, and the next
// free ID for a record of one of its numbered kinds. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { DOMAIN_KINDS, DOMAIN_SLICE, domainsFrom, type Domain, type DomainKind } from './model.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The domain that holds the record: the domain itself, or a capability, term, domain service, service, test or repository in it. */
export function getDomain(view: ReadView, input: { id: string }): Domain {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (!(record.kind in DOMAIN_KINDS)) refuse('kind', `${input.id} is a ${record.kind}, not a domain or a record in one`);
  let at = record;
  while (at.kind !== 'domain') {
    const column = DOMAIN_KINDS[at.kind as Exclude<DomainKind, 'domain'>];
    at = view.record(String(at.row[column]))!;
  }
  return domainsFrom((table) => view.rows(table), String(at.row.id))[0];
}

/** GET a domain whole (LA-AUT-QRY130). */
export const GET_DOMAIN: QueryDefinition<{ id: string }, Domain> = {
  id: 'LA-AUT-QRY130',
  slice: DOMAIN_SLICE,
  name: 'get-domain',
  description: 'Reads a domain whole, by its ID or the ID of any record in it: its row, capabilities with the outcomes they serve, terms, domain services with their services and tests, and repositories with the aggregates they persist.',
  input: { id: id('The domain, or a capability, term, domain service, service, test or repository in it.', 'required') },
  run: getDomain,
  text: domainText,
};

/** The domains of a product, by ID. */
export function listDomains(view: ReadView, input: { product_id: string }): { id: string; title: string }[] {
  if (view.record(input.product_id)?.kind !== 'product') refuse('missing', `there is no product ${input.product_id}`);
  return view
    .rows('domain')
    .filter((d) => d.product_id === input.product_id)
    .map((d) => ({ id: String(d.id), title: String(d.title) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** List the domains of a product (LA-AUT-QRY131). */
export const LIST_DOMAINS: QueryDefinition<{ product_id: string }, { id: string; title: string }[]> = {
  id: 'LA-AUT-QRY131',
  slice: DOMAIN_SLICE,
  name: 'list-domains',
  description: 'Lists the domains of a product, by ID, with their titles.',
  input: { product_id: id('The product.', 'required') },
  run: listDomains,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No domains.'),
};

// One past the highest number in use after the prefix, padded to two digits.
function onePast(view: ReadView, prefix: string): string {
  const shape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  let highest = 0;
  for (const kind of Object.keys(view.schema.kinds)) {
    for (const row of view.rows(kind)) {
      const m = shape.exec(String(row.id));
      if (m) highest = Math.max(highest, Number(m[1]));
    }
  }
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

/** The numbered kinds of the aggregate, each with the kind of record it sits under. */
const UNDER: Record<Exclude<DomainKind, 'domain'>, string> = {
  capability: 'domain',
  term: 'domain',
  domain_service: 'domain',
  repository: 'domain',
  service: 'domain_service',
  domain_service_test: 'domain_service',
};

/**
 * The next free ID for a record of one of the aggregate's numbered kinds under its parent: one past the highest in
 * use. A domain service has one service, whose ID is the domain service's and SV. A domain's own ID is its product's
 * and a code chosen for it, so it has no next ID.
 */
export function nextDomainId(view: ReadView, input: { kind: string; parent: string }): string {
  if (input.kind === 'domain') refuse('kind', "a domain's ID is its product's ID and a code chosen for it, such as TL-LEND, so it has no next ID");
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Domain aggregate; its numbered kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as keyof typeof UNDER;
  const parent = view.record(input.parent);
  if (parent?.kind !== UNDER[kind]) refuse('parent', `a ${kind} sits under a ${UNDER[kind]}, and ${input.parent} is ${parent ? `a ${parent.kind}` : 'no record'}`);
  switch (kind) {
    case 'capability':
      return onePast(view, `${input.parent}-CAP`);
    case 'term':
      return onePast(view, `${input.parent}-TM`);
    case 'domain_service':
      return onePast(view, `${input.parent}-DS`);
    case 'repository':
      return onePast(view, `${input.parent}-REPO`);
    case 'domain_service_test':
      return onePast(view, `${input.parent}-T`);
    case 'service': {
      const serviceId = `${input.parent}-SV`;
      if (view.record(serviceId)) refuse('exists', `${input.parent} already has its service, ${serviceId}`);
      return serviceId;
    }
  }
}

/** Get the next ID for a record of the Domain aggregate (LA-AUT-QRY132). */
export const NEXT_DOMAIN_ID: QueryDefinition<{ kind: string; parent: string }, string> = {
  id: 'LA-AUT-QRY132',
  slice: DOMAIN_SLICE,
  name: 'next-id',
  description: 'The next free ID for a capability, term, domain service or repository (under a domain), or a service or domain service test (under a domain service): one past the highest in use.',
  input: {
    kind: id('The kind: capability, term, domain_service, repository, service or domain_service_test.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  run: nextDomainId,
  text: (next) => next,
};

/** A domain as text: its row, then each of its records with what is under it and the links it starts. */
function domainText(domain: Domain): string {
  const { domain: row } = domain;
  const lines = [`Domain ${row.id}: ${row.title}`, `  product: ${row.product_id}`, `  subdomain type: ${row.subdomain_type}`, `  description: ${row.description}`];
  if (row.notes) lines.push(`  notes: ${row.notes}`);
  const technical = (t: { meets: string[]; packages: string[] }) => [...t.meets.map((x) => `meets ${x}`), ...t.packages.map((x) => `uses ${x}`)];
  const listed = (links: string[]) => (links.length ? ` [${links.join('; ')}]` : '');
  for (const c of domain.capabilities) lines.push(`Capability ${c.row.id}: ${c.row.title} (position ${c.row.position})${listed(c.serves.map((x) => `serves ${x}`))}`);
  for (const t of domain.terms) lines.push(`Term ${t.id}: ${t.title}`);
  for (const s of domain.domainServices) {
    lines.push(`Domain service ${s.id}: ${s.title}`);
    for (const v of domain.services.filter((x) => x.row.domain_service_id === s.id)) lines.push(`  service ${v.row.id}: ${v.row.title}${listed(technical(v))}`);
    for (const t of domain.domainServiceTests.filter((x) => x.row.domain_service_id === s.id)) lines.push(`  domain service test ${t.row.id}: ${t.row.title} (${t.row.state})`);
  }
  for (const r of domain.repositories) lines.push(`Repository ${r.row.id}: ${r.row.title}${listed([...(r.persists ? [`persists ${r.persists}`] : []), ...technical(r)])}`);
  return lines.join('\n');
}

/** The Domain aggregate's queries, as the CLI and the MCP server register them. */
export const DOMAIN_QUERIES: readonly AnyQuery[] = [GET_DOMAIN, LIST_DOMAINS, NEXT_DOMAIN_ID];
