// The Endpoint aggregate's own reads, each answered from its read model (LA-AUT-RM33) through its reader (reader.ts),
// which the query runner gives each handler: an endpoint whole as its page reads it, the endpoints of a command or
// query, and the next free ID for a record of one of its kinds. A handler never sees the data, a repository or the
// aggregate's model; each changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { type EndpointKind } from './model.ts';
import type { EndpointPage, EndpointSummary } from './read-model.ts';
import { endpointReader, type EndpointReader } from './reader.ts';
import { GET_ENDPOINT_IDENTITY, LIST_ENDPOINTS_IDENTITY, NEXT_ENDPOINT_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (kind: string) => (/^[aeiou]/.test(kind) ? 'an' : 'a');

/** The endpoint that holds the record, as its page reads it: the endpoint itself, or one of its requirements, its handler or a test. */
export function getEndpoint(reader: EndpointReader, input: { id: string }): EndpointPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not an endpoint or a record in one`);
}

/** GET an endpoint whole (LA-AUT-QRY194). */
export const GET_ENDPOINT: QueryDefinition<{ id: string }, EndpointPage, EndpointReader> = {
  ...GET_ENDPOINT_IDENTITY,
  input: { id: id('The endpoint, or an API requirement, endpoint handler or endpoint test in it.', 'required') },
  reader: endpointReader,
  run: getEndpoint,
  text: endpointText,
};

/** The endpoints of a command or query, by ID. */
export function listEndpoints(reader: EndpointReader, input: { parent: string }): EndpointSummary[] {
  return reader.endpointsOf(input.parent) ?? refuse('missing', `there is no command or query ${input.parent}`);
}

/** List the endpoints of a command or query (LA-AUT-QRY195). */
export const LIST_ENDPOINTS: QueryDefinition<{ parent: string }, EndpointSummary[], EndpointReader> = {
  ...LIST_ENDPOINTS_IDENTITY,
  input: { parent: id('The command or query.', 'required') },
  reader: endpointReader,
  run: listEndpoints,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No endpoints.'),
};

/** The kinds of the aggregate with an ID under a parent; how each is written the schema says (`idShape`). */
const KINDS: readonly string[] = ['endpoint', 'api_requirement', 'endpoint_handler', 'endpoint_test'];

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: one past the highest in use. An
 * endpoint's is numbered across the domain of its command or query; an endpoint has one handler, whose ID is the
 * endpoint's and H.
 */
export function nextEndpointId(reader: EndpointReader, input: { kind: string; parent: string }): string {
  if (!KINDS.includes(input.kind)) refuse('kind', `${input.kind} is not a kind of the Endpoint aggregate; its kinds are ${KINDS.join(', ')}`);
  const kind = input.kind as EndpointKind;
  const shape = reader.idShape(kind);
  const parent = reader.kindOf(input.parent);
  if (!parent || !shape.parents.includes(parent)) refuse('parent', `${article(kind)} ${kind} sits under ${shape.parents.map((k) => `${article(k)} ${k}`).join(' or ')}, and ${input.parent} is ${parent ? `${article(parent)} ${parent}` : 'no record'}`);
  switch (kind) {
    case 'endpoint':
      return onePast(reader, `${reader.domainOf(input.parent)}-${shape.letters}`, shape);
    case 'api_requirement':
    case 'endpoint_test':
      return onePast(reader, `${input.parent}-${shape.letters}`, shape);
    case 'endpoint_handler': {
      const handlerId = `${input.parent}-${shape.letters}`;
      if (reader.kindOf(handlerId)) refuse('exists', `${input.parent} already has its endpoint handler, ${handlerId}`);
      return handlerId;
    }
  }
}

/** Get the next ID in an endpoint (LA-AUT-QRY196). */
export const NEXT_ENDPOINT_ID: QueryDefinition<{ kind: string; parent: string }, string, EndpointReader> = {
  ...NEXT_ENDPOINT_ID_IDENTITY,
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
  const { endpoint: row } = page;
  const lines = [`Endpoint ${row.id}: ${row.title}`, `  exposes: ${row.command_id ?? row.query_id}`, `  description: ${row.description}`];
  if (row.notes) lines.push(`  notes: ${row.notes}`);
  if (page.handler) {
    const { handler: h, meets, packages } = page.handler;
    const extra = [...(h.file ? [h.file] : []), ...meets.map((x) => `meets ${x}`), ...packages.map((x) => `uses ${x}`)];
    lines.push(`Endpoint handler ${h.id}: ${h.title}${extra.length ? ` [${extra.join('; ')}]` : ''}`);
  }
  for (const r of page.requirements) {
    lines.push(`API requirement ${r.requirement.id}: ${r.requirement.title}`);
    for (const t of r.tests) lines.push(`  endpoint test ${t.test.id}: ${t.test.title} (${t.test.state})`);
  }
  return lines.join('\n');
}
