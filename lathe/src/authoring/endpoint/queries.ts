// The Endpoint aggregate's own reads (read model LA-AUT-RM33): an endpoint whole, the endpoints of a command or query,
// and the next free ID for a record of one of its kinds. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { ENDPOINT_SLICE } from './model.ts';
import { endpointPageFrom, endpointSummariesFrom, type EndpointPage, type EndpointSummary } from './read-model.ts';

/** The kinds of the Endpoint aggregate below its root, each with the column that names its parent. */
const PARENT_COLUMN = { api_requirement: 'endpoint_id', endpoint_handler: 'endpoint_id', endpoint_test: 'api_requirement_id' } as const;
type EndpointKind = 'endpoint' | keyof typeof PARENT_COLUMN;

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The endpoint that holds the record: the endpoint itself, or one of its requirements, its handler or a test. */
export function getEndpoint(view: ReadView, input: { id: string }): EndpointPage {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (record.kind !== 'endpoint' && !(record.kind in PARENT_COLUMN)) refuse('kind', `${input.id} is ${/^[aeiou]/.test(record.kind) ? 'an' : 'a'} ${record.kind}, not an endpoint or a record in one`);
  let at = record;
  while (at.kind !== 'endpoint') {
    at = view.record(String(at.row[PARENT_COLUMN[at.kind as keyof typeof PARENT_COLUMN]]))!;
  }
  return endpointPageFrom((table) => view.rows(table), String(at.row.id))!;
}

/** GET an endpoint whole (LA-AUT-QRY194). */
export const GET_ENDPOINT: QueryDefinition<{ id: string }, EndpointPage> = {
  id: 'LA-AUT-QRY194',
  slice: ENDPOINT_SLICE,
  name: 'get-endpoint',
  method: 'GET',
  route: '/api/endpoint/get-endpoint',
  description: 'Reads an endpoint whole, by its ID or the ID of any record in it: its row, its API requirements with their tests, and its handler.',
  input: { id: id('The endpoint, or an API requirement, endpoint handler or endpoint test in it.', 'required') },
  run: getEndpoint,
  text: endpointText,
};

/** The endpoints of a command or query, by ID. */
export function listEndpoints(view: ReadView, input: { parent: string }): EndpointSummary[] {
  const parent = view.record(input.parent);
  if (parent?.kind !== 'command' && parent?.kind !== 'query') refuse('missing', `there is no command or query ${input.parent}`);
  return endpointSummariesFrom((table) => view.rows(table), input.parent);
}

/** List the endpoints of a command or query (LA-AUT-QRY195). */
export const LIST_ENDPOINTS: QueryDefinition<{ parent: string }, EndpointSummary[]> = {
  id: 'LA-AUT-QRY195',
  slice: ENDPOINT_SLICE,
  name: 'list-endpoints',
  method: 'GET',
  route: '/api/endpoint/list-endpoints',
  description: 'Lists the endpoints that expose a command or query, by ID, with their titles.',
  input: { parent: id('The command or query.', 'required') },
  run: listEndpoints,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No endpoints.'),
};

// One past the highest number in use after the prefix among the kind's records, padded to two digits.
function onePast(view: ReadView, kind: string, prefix: string): string {
  const shape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  let highest = 0;
  for (const row of view.rows(kind)) {
    const m = shape.exec(String(row.id));
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

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
export function nextEndpointId(view: ReadView, input: { kind: string; parent: string }): string {
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Endpoint aggregate; its kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as EndpointKind;
  const parent = view.record(input.parent);
  if (!parent || !UNDER[kind].includes(parent.kind)) refuse('parent', `${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind} sits under ${UNDER[kind].map((k) => `${/^[aeiou]/.test(k) ? 'an' : 'a'} ${k}`).join(' or ')}, and ${input.parent} is ${parent ? `a ${parent.kind}` : 'no record'}`);
  switch (kind) {
    case 'endpoint': {
      const domain = view
        .rows('domain')
        .map((d) => String(d.id))
        .filter((d) => input.parent.startsWith(`${d}-`))
        .sort((a, b) => b.length - a.length)[0];
      return onePast(view, 'endpoint', `${domain}-EP`);
    }
    case 'api_requirement':
      return onePast(view, 'api_requirement', `${input.parent}-R`);
    case 'endpoint_test':
      return onePast(view, 'endpoint_test', `${input.parent}-T`);
    case 'endpoint_handler': {
      const handlerId = `${input.parent}-H`;
      if (view.record(handlerId)) refuse('exists', `${input.parent} already has its endpoint handler, ${handlerId}`);
      return handlerId;
    }
  }
}

/** Get the next ID in an endpoint (LA-AUT-QRY196). */
export const NEXT_ENDPOINT_ID: QueryDefinition<{ kind: string; parent: string }, string> = {
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
