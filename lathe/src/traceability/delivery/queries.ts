// The Delivery read (LA-TRC-RM13): a product's use cases as the Trace stage's Delivery view draws them, one row each
// from its outcomes to its acceptance tests, answered from the read model through its reader (reader.ts). Gaps and
// tests are the checks' run's, so the query says it reads the run (`checked`): the server gives it the run it keeps for
// the data, the CLI and the MCP tool run the checks first. Its handler never sees the data and changes nothing. This
// slice holds only the read, so it names its read model where an aggregate's slice names its aggregate.
import { id, type AnyQuery, type QueryDefinition, type Slice } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { DeliveryRow, ProductDelivery } from './read-model.ts';
import { deliveryReader, type DeliveryReader } from './reader.ts';

/** How the interfaces reach the Delivery read: `lathe delivery`, the delivery_ tools, /api/delivery/. */
const DELIVERY_SLICE: Slice = { aggregate: 'LA-TRC-RM13', name: 'delivery' };

/** Each use case of the product's space with its outcomes, requirements, flows, technical chains and acceptance tests. */
export function listDelivery(reader: DeliveryReader, input: { product_id: string }): ProductDelivery {
  const delivery = reader.deliveryOf(input.product_id);
  if (!delivery) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return delivery;
}

const all = (k: number, words: string) => (k === 0 ? `all ${words}` : `${k} not ${words}`);
/** A row's status per stage in words: "2 flows, all designed · 3 handlers, 1 not built · 4 tests, all proved". */
export const statusWords = (r: DeliveryRow): string => {
  const { design, technical, suite } = r.status;
  return `${design.flows} flow${design.flows === 1 ? '' : 's'}, ${all(design.notDesigned, 'designed')} · ${technical.handlers} handler${technical.handlers === 1 ? '' : 's'}, ${all(technical.notBuilt, 'built')} · ${suite.tests} test${suite.tests === 1 ? '' : 's'}, ${all(suite.notProved, 'proved')}`;
};

/** List a product's Delivery (LA-TRC-QRY18). */
export const LIST_DELIVERY: QueryDefinition<{ product_id: string }, ProductDelivery, DeliveryReader> = {
  id: 'LA-TRC-QRY18',
  slice: DELIVERY_SLICE,
  name: 'list-delivery',
  method: 'GET',
  route: '/api/delivery/list-delivery',
  description: "Lists each use case of a product's space once, from the business outcomes its capability serves to its acceptance tests: its UC requirements with their gaps and tests, the aggregates and read models its steps change and read, its flows with each step's design (what it fulfills, its view and view requirements, its endpoints and API requirements, its integrations) and technical chain (UI components, endpoints or channels, handler, repository or reader, data store, adapters), its flow tests, the lower obligations its tests rest on, and its status per stage. Runs the checks first.",
  input: { product_id: id('The product.', 'required') },
  checked: true,
  reader: deliveryReader,
  run: listDelivery,
  text: (p) =>
    [
      `${p.product}: ${p.rows.length} use case${p.rows.length === 1 ? '' : 's'}, ${p.outcomes.length} outcome${p.outcomes.length === 1 ? '' : 's'}`,
      ...p.rows.map((r) => `  ${r.useCase} (${r.outcomes.length ? r.outcomes.join(', ') : 'no outcome'}): ${statusWords(r)}`),
    ].join('\n'),
};

/** The Delivery read's queries, as the CLI and the MCP server register them. */
export const DELIVERY_QUERIES: readonly AnyQuery[] = [LIST_DELIVERY];
