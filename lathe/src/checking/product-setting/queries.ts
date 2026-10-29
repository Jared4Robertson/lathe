// The Product setting aggregate's own read, from its read model (LA-CHK-RM11): a product's limits, its own or the
// defaults. It reads the current data and changes nothing. A product has one settings row, named by the product, so
// it has no list or next ID.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { PRODUCT_SETTING_SLICE } from './model.ts';
import { limitsFrom, type Limits } from './read-model.ts';

/** The product's limits, with whether they are its own or the defaults. */
export function getLimits(view: ReadView, input: { product_id: string }): Limits {
  if (view.record(input.product_id)?.kind !== 'product') throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return limitsFrom((table) => view.rows(table), input.product_id);
}

/** GET the product's limits (LA-CHK-QRY12). */
export const GET_LIMITS: QueryDefinition<{ product_id: string }, Limits> = {
  id: 'LA-CHK-QRY12',
  slice: PRODUCT_SETTING_SLICE,
  name: 'get-limits',
  method: 'GET',
  route: '/api/product-setting/get-limits',
  description: "Reads a product's limits: the most children of one kind a record should hold and the most entities an aggregate should hold, its own or the defaults.",
  input: { product_id: id('The product.', 'required') },
  run: getLimits,
  text: (s) => `Limits of ${s.product}${s.own ? '' : ' (the defaults)'}\n  max_children: ${s.maxChildren}\n  max_entities_per_aggregate: ${s.maxEntitiesPerAggregate}`,
};

/** The Product setting aggregate's queries, as the CLI and the MCP server register them. */
export const PRODUCT_SETTING_QUERIES: readonly AnyQuery[] = [GET_LIMITS];
