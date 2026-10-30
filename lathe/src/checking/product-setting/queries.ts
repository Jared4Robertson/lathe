// The Product setting aggregate's own read, answered from its read model (LA-CHK-RM11) through its reader
// (reader.ts): a product's limits, its own or the defaults. Its handler never sees the data and changes nothing. A
// product has one settings row, named by the product, so it has no list or next ID.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { PRODUCT_SETTING_SLICE } from './model.ts';
import type { Limits } from './read-model.ts';
import { limitsReader, type LimitsReader } from './reader.ts';

/** The product's limits, with whether they are its own or the defaults. */
export function getLimits(reader: LimitsReader, input: { product_id: string }): Limits {
  const limits = reader.limitsOf(input.product_id);
  if (!limits) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return limits;
}

/** GET the product's limits (LA-CHK-QRY12). */
export const GET_LIMITS: QueryDefinition<{ product_id: string }, Limits, LimitsReader> = {
  id: 'LA-CHK-QRY12',
  slice: PRODUCT_SETTING_SLICE,
  name: 'get-limits',
  method: 'GET',
  route: '/api/product-setting/get-limits',
  description: "Reads a product's limits: the most children of one kind a record should hold and the most entities an aggregate should hold, its own or the defaults.",
  input: { product_id: id('The product.', 'required') },
  reader: limitsReader,
  run: getLimits,
  text: (s) => `Limits of ${s.product}${s.own ? '' : ' (the defaults)'}\n  max_children: ${s.maxChildren}\n  max_entities_per_aggregate: ${s.maxEntitiesPerAggregate}`,
};

/** The Product setting aggregate's queries, as the CLI and the MCP server register them. */
export const PRODUCT_SETTING_QUERIES: readonly AnyQuery[] = [GET_LIMITS];
