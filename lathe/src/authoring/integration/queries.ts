// The Integration aggregate's own reads (read model LA-AUT-RM34): an integration whole, the integrations of a product,
// and the next free ID for a record of one of its kinds. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { INTEGRATION_SLICE } from './model.ts';
import { integrationPageFrom, integrationSummariesFrom, type IntegrationPage, type IntegrationSummary } from './read-model.ts';

/** The kinds of the Integration aggregate. */
type IntegrationKind = 'integration' | 'adapter' | 'integration_test';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The integration that holds the record: the integration itself, its adapter or one of its tests. */
export function getIntegration(view: ReadView, input: { id: string }): IntegrationPage {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (!['integration', 'adapter', 'integration_test'].includes(record.kind)) refuse('kind', `${input.id} is ${/^[aeiou]/.test(record.kind) ? 'an' : 'a'} ${record.kind}, not an integration or a record in one`);
  const root = record.kind === 'integration' ? String(record.row.id) : String(record.row.integration_id);
  return integrationPageFrom((table) => view.rows(table), root)!;
}

/** GET an integration whole (LA-AUT-QRY199). */
export const GET_INTEGRATION: QueryDefinition<{ id: string }, IntegrationPage> = {
  id: 'LA-AUT-QRY199',
  slice: INTEGRATION_SLICE,
  name: 'get-integration',
  method: 'GET',
  route: '/api/integration/get-integration',
  description: 'Reads an integration whole, by its ID or the ID of any record in it: its row, its adapter and its integration tests.',
  input: { id: id('The integration, or its adapter or an integration test.', 'required') },
  run: getIntegration,
  text: integrationText,
};

/** The integrations of a product, by ID: those whose ID starts with the product's. */
export function listIntegrations(view: ReadView, input: { product_id: string }): IntegrationSummary[] {
  if (view.record(input.product_id)?.kind !== 'product') refuse('missing', `there is no product ${input.product_id}`);
  return integrationSummariesFrom((table) => view.rows(table), input.product_id);
}

/** List the integrations of a product (LA-AUT-QRY200). */
export const LIST_INTEGRATIONS: QueryDefinition<{ product_id: string }, IntegrationSummary[]> = {
  id: 'LA-AUT-QRY200',
  slice: INTEGRATION_SLICE,
  name: 'list-integrations',
  method: 'GET',
  route: '/api/integration/list-integrations',
  description: 'Lists the integrations of a product, by ID, with their titles.',
  input: { product_id: id('The product.', 'required') },
  run: listIntegrations,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No integrations.'),
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

/** The kinds of the aggregate, each with the kind of record it sits under. */
const UNDER: Record<IntegrationKind, string> = { integration: 'product', adapter: 'integration', integration_test: 'integration' };

/** The next free ID for a record of one of the aggregate's kinds under its parent; an integration has one adapter, whose ID is its own and AD. */
export function nextIntegrationId(view: ReadView, input: { kind: string; parent: string }): string {
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Integration aggregate; its kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as IntegrationKind;
  const parent = view.record(input.parent);
  if (parent?.kind !== UNDER[kind]) refuse('parent', `${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind} sits under ${/^[aeiou]/.test(UNDER[kind]) ? 'an' : 'a'} ${UNDER[kind]}, and ${input.parent} is ${parent ? `a ${parent.kind}` : 'no record'}`);
  switch (kind) {
    case 'integration':
      return onePast(view, 'integration', `${input.parent}-INT`);
    case 'integration_test':
      return onePast(view, 'integration_test', `${input.parent}-T`);
    case 'adapter': {
      const adapterId = `${input.parent}-AD`;
      if (view.record(adapterId)) refuse('exists', `${input.parent} already has its adapter, ${adapterId}`);
      return adapterId;
    }
  }
}

/** Get the next ID in an integration (LA-AUT-QRY201). */
export const NEXT_INTEGRATION_ID: QueryDefinition<{ kind: string; parent: string }, string> = {
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
  run: nextIntegrationId,
  text: (next) => next,
};

/** An integration as text: its row, its adapter, then its tests. */
function integrationText(page: IntegrationPage): string {
  const lines = [`Integration ${page.id}: ${page.title}`, ...(page.system ? [`  system: ${page.system}`] : []), `  description: ${page.description}`];
  const a = page.adapter;
  if (a) {
    const extra = [...(a.file ? [a.file] : []), ...a.meets.map((x) => `meets ${x}`), ...a.packages.map((x) => `uses ${x}`)];
    lines.push(`Adapter ${a.id}: ${a.title}${extra.length ? ` [${extra.join('; ')}]` : ''}`);
  }
  for (const t of page.tests) lines.push(`Integration test ${t.id}: ${t.title} (${t.state})`);
  return lines.join('\n');
}

/** The Integration aggregate's queries, as the CLI and the MCP server register them. */
export const INTEGRATION_QUERIES: readonly AnyQuery[] = [GET_INTEGRATION, LIST_INTEGRATIONS, NEXT_INTEGRATION_ID];
