// The Domain aggregate's own reads, each answered from its read model (LA-AUT-RM24) through its reader (reader.ts),
// which the query runner gives each handler: a domain whole as its page reads it, the domains of a product, and the
// next free ID for a record of one of its numbered kinds. A handler never sees the data, a repository or the
// aggregate's model; each changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { DOMAIN_SLICE } from './model.ts';
import type { DomainPage, DomainSummary } from './read-model.ts';
import { domainReader, type DomainReader } from './reader.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (kind: string) => (/^[aeiou]/.test(kind) ? 'an' : 'a');

/** The domain that holds the record, as its page reads it: the domain itself, or a capability, term, domain service, service, test or repository in it. */
export function getDomain(reader: DomainReader, input: { id: string }): DomainPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not a domain or a record in one`);
}

/** GET a domain whole (LA-AUT-QRY130). */
export const GET_DOMAIN: QueryDefinition<{ id: string }, DomainPage, DomainReader> = {
  id: 'LA-AUT-QRY130',
  slice: DOMAIN_SLICE,
  name: 'get-domain',
  description: 'Reads a domain whole as its page shows it, by its ID or the ID of any record in it: the record asked for and its kind, the domain\'s row, its capabilities in order with the outcomes they serve and their use cases, its terms bottom-up with the terms they build on, its domain services with their services and tests, and its repositories with the aggregates they persist.',
  method: 'GET',
  route: '/api/domain/get-domain',
  input: { id: id('The domain, or a capability, term, domain service, service, test or repository in it.', 'required') },
  reader: domainReader,
  run: getDomain,
  text: domainText,
};

/** The domains of a product, by ID. */
export function listDomains(reader: DomainReader, input: { product_id: string }): DomainSummary[] {
  return reader.domainsOf(input.product_id) ?? refuse('missing', `there is no product ${input.product_id}`);
}

/** List the domains of a product (LA-AUT-QRY131). */
export const LIST_DOMAINS: QueryDefinition<{ product_id: string }, DomainSummary[], DomainReader> = {
  id: 'LA-AUT-QRY131',
  slice: DOMAIN_SLICE,
  name: 'list-domains',
  description: 'Lists the domains of a product, by ID, with their titles.',
  method: 'GET',
  route: '/api/domain/list-domains',
  input: { product_id: id('The product.', 'required') },
  reader: domainReader,
  run: listDomains,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No domains.'),
};

/** The kinds of the aggregate with an ID under a parent; how each is written the schema says (`idShape`). */
const KINDS: readonly string[] = ['capability', 'term', 'domain_service', 'repository', 'service', 'domain_service_test'];

/**
 * The next free ID for a record of one of the aggregate's numbered kinds under its parent: one past the highest in
 * use. A domain service has one service, whose ID is the domain service's and SV. A domain's own ID is its product's
 * and a code chosen for it, so it has no next ID.
 */
export function nextDomainId(reader: DomainReader, input: { kind: string; parent: string }): string {
  if (input.kind === 'domain') refuse('kind', "a domain's ID is its product's ID and a code chosen for it, such as TL-LEND, so it has no next ID");
  if (!KINDS.includes(input.kind)) refuse('kind', `${input.kind} is not a kind of the Domain aggregate; its numbered kinds are ${KINDS.join(', ')}`);
  const kind = input.kind;
  const shape = reader.idShape(kind);
  const parentKind = reader.kindOf(input.parent);
  if (parentKind !== shape.parents[0]) refuse('parent', `a ${kind} sits under a ${shape.parents[0]}, and ${input.parent} is ${parentKind ? `${article(parentKind)} ${parentKind}` : 'no record'}`);
  if (kind === 'service') {
    const serviceId = `${input.parent}-${shape.letters}`;
    if (reader.kindOf(serviceId)) refuse('exists', `${input.parent} already has its service, ${serviceId}`);
    return serviceId;
  }
  return onePast(reader, `${input.parent}-${shape.letters}`, shape);
}

/** Get the next ID for a record of the Domain aggregate (LA-AUT-QRY132). */
export const NEXT_DOMAIN_ID: QueryDefinition<{ kind: string; parent: string }, string, DomainReader> = {
  id: 'LA-AUT-QRY132',
  slice: DOMAIN_SLICE,
  name: 'next-id',
  description: 'The next free ID for a capability, term, domain service or repository (under a domain), or a service or domain service test (under a domain service): one past the highest in use.',
  method: 'GET',
  route: '/api/domain/next-id',
  input: {
    kind: id('The kind: capability, term, domain_service, repository, service or domain_service_test.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  reader: domainReader,
  run: nextDomainId,
  text: (next) => next,
};

/** A domain as text: its row, then each of its records with what is under it and the links it starts. */
function domainText(page: DomainPage): string {
  const { domain: row } = page;
  const lines = [`Domain ${row.id}: ${row.title}`, `  product: ${row.product_id}`, `  subdomain type: ${row.subdomain_type}`, `  description: ${row.description}`];
  if (row.notes) lines.push(`  notes: ${row.notes}`);
  const technical = (t: { meets: string[]; packages: string[] }) => [...t.meets.map((x) => `meets ${x}`), ...t.packages.map((x) => `uses ${x}`)];
  const listed = (links: string[]) => (links.length ? ` [${links.join('; ')}]` : '');
  for (const c of page.capabilities) lines.push(`Capability ${c.capability.id}: ${c.capability.title} (position ${c.capability.position})${listed(c.serves.map((x) => `serves ${x}`))}`);
  for (const t of page.terms) lines.push(`Term ${t.term.id}: ${t.term.title}${listed(t.buildsOn.map((x) => `builds on ${x}`))}`);
  for (const s of page.domainServices) {
    lines.push(`Domain service ${s.domainService.id}: ${s.domainService.title}`);
    if (s.service) lines.push(`  service ${s.service.service.id}: ${s.service.service.title}${listed(technical(s.service))}`);
    for (const t of s.tests) lines.push(`  domain service test ${t.test.id}: ${t.test.title} (${t.test.state})`);
  }
  for (const r of page.repositories) lines.push(`Repository ${r.repository.id}: ${r.repository.title}${listed([...(r.persists ? [`persists ${r.persists}`] : []), ...technical(r)])}`);
  return lines.join('\n');
}

/** The Domain aggregate's queries, as the CLI and the MCP server register them. */
export const DOMAIN_QUERIES: readonly AnyQuery[] = [GET_DOMAIN, LIST_DOMAINS, NEXT_DOMAIN_ID];
