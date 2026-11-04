// The Domain aggregate's own reads, each answered from its read model (LA-MOD-RM24) through its reader (reader.ts),
// which the query runner gives each handler: a domain whole as its page reads it, the domains of a product, and the
// next free ID for a record of one of its numbered kinds. A handler never sees the data, a repository or the
// aggregate's model; each changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { DomainPage, DomainSummary } from './read-model.ts';
import { domainReader, type DomainReader } from './reader.ts';
import { GET_DOMAIN_IDENTITY, LIST_DOMAINS_IDENTITY, NEXT_DOMAIN_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (kind: string) => (/^[aeiou]/.test(kind) ? 'an' : 'a');

/** The domain that holds the record, as its page reads it: the domain itself, or a capability, term, domain service, service, test or repository in it. */
export function getDomain(reader: DomainReader, input: { id: string }): DomainPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not a domain or a record in one`);
}

/** GET a domain whole (LA-MOD-QRY130). */
export const GET_DOMAIN: QueryDefinition<{ id: string }, DomainPage, DomainReader> = {
  ...GET_DOMAIN_IDENTITY,
  input: { id: id('The domain, or a capability, term, domain service, service, test or repository in it.', 'required') },
  reader: domainReader,
  run: getDomain,
  text: domainText,
};

/** The domains of a product, by position. */
export function listDomains(reader: DomainReader, input: { product_id: string }): DomainSummary[] {
  return reader.domainsOf(input.product_id) ?? refuse('missing', `there is no product ${input.product_id}`);
}

/** List the domains of a product (LA-MOD-QRY131). */
export const LIST_DOMAINS: QueryDefinition<{ product_id: string }, DomainSummary[], DomainReader> = {
  ...LIST_DOMAINS_IDENTITY,
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

/** Get the next ID for a record of the Domain aggregate (LA-MOD-QRY132). */
export const NEXT_DOMAIN_ID: QueryDefinition<{ kind: string; parent: string }, string, DomainReader> = {
  ...NEXT_DOMAIN_ID_IDENTITY,
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
  const technical = (t: { meets: string[]; packages: string[]; helpers: string[] }) => [...t.meets.map((x) => `meets ${x}`), ...t.packages.map((x) => `uses ${x}`), ...t.helpers.map((x) => `helper file ${x}`)];
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
