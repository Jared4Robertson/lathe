// The Integration aggregate's own reads, each answered from its read model (LA-AUT-RM34) through its reader
// (reader.ts), which the query runner gives each handler: an integration whole as its page reads it, the integrations
// of a product, and the next free ID for a record of one of its kinds. A handler never sees the data, a repository or
// the aggregate's model; each changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { INTEGRATION_SLICE, type IntegrationKind } from './model.ts';
import type { IntegrationPage, IntegrationSummary } from './read-model.ts';
import { integrationReader, type IntegrationReader } from './reader.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (kind: string) => (/^[aeiou]/.test(kind) ? 'an' : 'a');

/** The integration that holds the record, as its page reads it: the integration itself, its adapter or one of its tests. */
export function getIntegration(reader: IntegrationReader, input: { id: string }): IntegrationPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not an integration or a record in one`);
}

/** GET an integration whole (LA-AUT-QRY199). */
export const GET_INTEGRATION: QueryDefinition<{ id: string }, IntegrationPage, IntegrationReader> = {
  id: 'LA-AUT-QRY199',
  slice: INTEGRATION_SLICE,
  name: 'get-integration',
  method: 'GET',
  route: '/api/integration/get-integration',
  description: "Reads an integration whole as its page shows it, by its ID or the ID of any record in it: the record asked for and its kind, the integration's row, its adapter (with the standard rules it meets and the packages it uses), and its integration tests by ID (with the test data sets they start from).",
  input: { id: id('The integration, or its adapter or an integration test.', 'required') },
  reader: integrationReader,
  run: getIntegration,
  text: integrationText,
};

/** The integrations of a product, by ID: those whose ID starts with the product's. */
export function listIntegrations(reader: IntegrationReader, input: { product_id: string }): IntegrationSummary[] {
  return reader.integrationsOf(input.product_id) ?? refuse('missing', `there is no product ${input.product_id}`);
}

/** List the integrations of a product (LA-AUT-QRY200). */
export const LIST_INTEGRATIONS: QueryDefinition<{ product_id: string }, IntegrationSummary[], IntegrationReader> = {
  id: 'LA-AUT-QRY200',
  slice: INTEGRATION_SLICE,
  name: 'list-integrations',
  method: 'GET',
  route: '/api/integration/list-integrations',
  description: 'Lists the integrations of a product, by ID, with their titles.',
  input: { product_id: id('The product.', 'required') },
  reader: integrationReader,
  run: listIntegrations,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No integrations.'),
};


/** The kinds of the aggregate with an ID under a parent; how each is written the schema says (`idShape`). */
const KINDS: readonly string[] = ['integration', 'adapter', 'integration_test'];

/** The next free ID for a record of one of the aggregate's kinds under its parent; an integration has one adapter, whose ID is its own and AD. */
export function nextIntegrationId(reader: IntegrationReader, input: { kind: string; parent: string }): string {
  if (!KINDS.includes(input.kind)) refuse('kind', `${input.kind} is not a kind of the Integration aggregate; its kinds are ${KINDS.join(', ')}`);
  const kind = input.kind as IntegrationKind;
  const shape = reader.idShape(kind);
  const parent = reader.kindOf(input.parent);
  if (parent !== shape.parents[0]) refuse('parent', `${article(kind)} ${kind} sits under ${article(shape.parents[0])} ${shape.parents[0]}, and ${input.parent} is ${parent ? `${article(parent)} ${parent}` : 'no record'}`);
  switch (kind) {
    case 'integration':
      return onePast(reader, `${input.parent}-${shape.letters}`, shape);
    case 'integration_test':
      return onePast(reader, `${input.parent}-${shape.letters}`, shape);
    case 'adapter': {
      const adapterId = `${input.parent}-${shape.letters}`;
      if (reader.kindOf(adapterId)) refuse('exists', `${input.parent} already has its adapter, ${adapterId}`);
      return adapterId;
    }
  }
}

/** Get the next ID in an integration (LA-AUT-QRY201). */
export const NEXT_INTEGRATION_ID: QueryDefinition<{ kind: string; parent: string }, string, IntegrationReader> = {
  id: 'LA-AUT-QRY201',
  slice: INTEGRATION_SLICE,
  name: 'next-id',
  method: 'GET',
  route: '/api/integration/next-id',
  description: 'The next free ID for an integration (under a product), or an adapter or integration test (under an integration): one past the highest in use.',
  input: {
    kind: id('The kind: integration, adapter or integration_test.', 'required'),
    parent: id('The record it will sit under: for an integration, its product.', 'required'),
  },
  reader: integrationReader,
  run: nextIntegrationId,
  text: (next) => next,
};

/** An integration as text: its row, its adapter, then its tests. */
function integrationText(page: IntegrationPage): string {
  const { integration: row } = page;
  const lines = [`Integration ${row.id}: ${row.title}`, ...(row.system ? [`  system: ${row.system}`] : []), `  description: ${row.description}`];
  if (page.adapter) {
    const { adapter: a, meets, packages } = page.adapter;
    const extra = [...(a.file ? [a.file] : []), ...meets.map((x) => `meets ${x}`), ...packages.map((x) => `uses ${x}`)];
    lines.push(`Adapter ${a.id}: ${a.title}${extra.length ? ` [${extra.join('; ')}]` : ''}`);
  }
  for (const t of page.tests) lines.push(`Integration test ${t.test.id}: ${t.test.title} (${t.test.state})`);
  return lines.join('\n');
}

/** The Integration aggregate's queries, as the CLI and the MCP server register them. */
export const INTEGRATION_QUERIES: readonly AnyQuery[] = [GET_INTEGRATION, LIST_INTEGRATIONS, NEXT_INTEGRATION_ID];
