// The Endpoint aggregate's own reads, each answered from its read model (LA-AUT-RM33) through its reader (reader.ts),
// which the query runner gives each handler: an endpoint whole, the endpoints of a command or query, and the next free
// ID for a record of one of its kinds. A handler never sees the data, a repository or the aggregate's model.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { ENDPOINT_SLICE, type EndpointKind } from './model.ts';
import type { EndpointPage, EndpointSummary } from './read-model.ts';
import { endpointReader, type EndpointReader } from './reader.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The endpoint that holds the record: the endpoint itself, or one of its requirements, its handler or a test. */
export function getEndpoint(reader: EndpointReader, input: { id: string }): EndpointPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}, not an endpoint or a record in one`);
}

/** GET an endpoint whole (LA-AUT-QRY194). */
export const GET_ENDPOINT: QueryDefinition<{ id: string }, EndpointPage, EndpointReader> = {
  id: 'LA-AUT-QRY194',
  slice: ENDPOINT_SLICE,
  name: 'get-endpoint',
  method: 'GET',
  route: '/api/endpoint/get-endpoint',
  description: 'Reads an endpoint whole, by its ID or the ID of any record in it: its row, its API requirements with their tests, and its handler.',
  input: { id: id('The endpoint, or an API requirement, endpoint handler or endpoint test in it.', 'required') },
  reader: endpointReader,
  run: getEndpoint,
  text: endpointText,
};

/** The endpoints of a command or query, by ID. */
export function listEndpoints(reader: EndpointReader, input: { parent: string }): EndpointSummary[] {
  const parent = reader.kindOf(input.parent);
  if (parent !== 'command' && parent !== 'query') refuse('missing', `there is no command or query ${input.parent}`);
  return reader.endpointsOf(input.parent);
}

/** List the endpoints of a command or query (LA-AUT-QRY195). */
export const LIST_ENDPOINTS: QueryDefinition<{ parent: string }, EndpointSummary[], EndpointReader> = {
  id: 'LA-AUT-QRY195',
  slice: ENDPOINT_SLICE,
  name: 'list-endpoints',
  method: 'GET',
  route: '/api/endpoint/list-endpoints',
  description: 'Lists the endpoints that expose a command or query, by ID, with their titles.',
  input: { parent: id('The command or query.', 'required') },
  reader: endpointReader,
  run: listEndpoints,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No endpoints.'),
};

// One past the highest number in use after the prefix, padded to two digits.
const onePast = (reader: EndpointReader, prefix: string): string => `${prefix}${String(reader.highestAfter(prefix) + 1).padStart(2, '0')}`;

/** The kinds of the aggregate, each with the kinds of record it sits under. */
const UNDER: Record<EndpointKind, string[]> = {
  endpoint: ['command', 'query'],
  api_requirement: ['endpoint'],
  endpoint_handler: ['endpoint'],
  endpoint_test: ['api_requirement'],
};

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: one past the highest in use. An
 * endpoint's is numbered across the domain of its command or query; an endpoint has one handler, whose ID is the
 * endpoint's and H.
 */
export function nextEndpointId(reader: EndpointReader, input: { kind: string; parent: string }): string {
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Endpoint aggregate; its kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as EndpointKind;
  const parent = reader.kindOf(input.parent);
  if (!parent || !UNDER[kind].includes(parent)) refuse('parent', `${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind} sits under ${UNDER[kind].map((k) => `${/^[aeiou]/.test(k) ? 'an' : 'a'} ${k}`).join(' or ')}, and ${input.parent} is ${parent ? `a ${parent}` : 'no record'}`);
  switch (kind) {
    case 'endpoint':
      return onePast(reader, `${reader.domainOf(input.parent)}-EP`);
    case 'api_requirement':
      return onePast(reader, `${input.parent}-R`);
    case 'endpoint_test':
      return onePast(reader, `${input.parent}-T`);
    case 'endpoint_handler': {
      const handlerId = `${input.parent}-H`;
      if (reader.kindOf(handlerId)) refuse('exists', `${input.parent} already has its endpoint handler, ${handlerId}`);
      return handlerId;
    }
  }
}

/** Get the next ID in an endpoint (LA-AUT-QRY196). */
export const NEXT_ENDPOINT_ID: QueryDefinition<{ kind: string; parent: string }, string, EndpointReader> = {
  id: 'LA-AUT-QRY196',
  slice: ENDPOINT_SLICE,
  name: 'next-id',
  method: 'GET',
  route: '/api/endpoint/next-id',
  description: 'The next free ID for an endpoint (under a command or query), an API requirement or endpoint handler (under an endpoint) or an endpoint test (under an API requirement): one past the highest in use.',
  input: {
    kind: id('The kind: endpoint, api_requirement, endpoint_handler or endpoint_test.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  reader: endpointReader,
  run: nextEndpointId,
  text: (next) => next,
};

/** An endpoint as text: its row, its handler, then each requirement with its tests. */
function endpointText(page: EndpointPage): string {
  const lines = [`Endpoint ${page.id}: ${page.title}`, `  exposes: ${page.exposes}`, `  description: ${page.description}`];
  if (page.notes) lines.push(`  notes: ${page.notes}`);
  const h = page.handler;
  if (h) {
    const extra = [...(h.file ? [h.file] : []), ...h.meets.map((x) => `meets ${x}`), ...h.packages.map((x) => `uses ${x}`)];
    lines.push(`Endpoint handler ${h.id}: ${h.title}${extra.length ? ` [${extra.join('; ')}]` : ''}`);
  }
  for (const r of page.requirements) {
    lines.push(`API requirement ${r.id}: ${r.title}`);
    for (const t of r.tests) lines.push(`  endpoint test ${t.id}: ${t.title} (${t.state})`);
  }
  return lines.join('\n');
}

/** The Endpoint aggregate's queries, as the CLI and the MCP server register them. */
export const ENDPOINT_QUERIES: readonly AnyQuery[] = [GET_ENDPOINT, LIST_ENDPOINTS, NEXT_ENDPOINT_ID];
