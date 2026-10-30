// The ERD read (LA-EXP-RM04): a product's one entity-relationship diagram, which the ERD stage lays out and draws,
// answered from the read model through its reader (reader.ts). Its handler never sees the data and changes nothing.
// This slice holds only the read, so it names its read model where an aggregate's slice names its aggregate.
import { id, type AnyQuery, type QueryDefinition, type Slice } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ErdMap } from './read-model.ts';
import { erdReader, type ErdReader } from './reader.ts';

/** How the interfaces reach the ERD read: `lathe erd`, the erd_ tools, /api/erd/. */
const ERD_SLICE: Slice = { aggregate: 'LA-EXP-RM04', name: 'erd' };

/** The product's map: its domains, aggregates and entities, and the lines between them. */
export function getErd(reader: ErdReader, input: { product_id: string }): ErdMap {
  const map = reader.mapOf(input.product_id);
  if (!map) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return map;
}

/** Get the ERD map (LA-EXP-QRY10). */
export const GET_ERD: QueryDefinition<{ product_id: string }, ErdMap, ErdReader> = {
  id: 'LA-EXP-QRY10',
  slice: ERD_SLICE,
  name: 'get-erd',
  method: 'GET',
  route: '/api/erd/get-erd',
  description: "Gets a product's ERD map: every domain's region, each aggregate's boundary with its entities (the root first) and their fields and types, and the has-one, has-many and reference-by-ID lines between entities.",
  input: { product_id: id('The product.', 'required') },
  reader: erdReader,
  run: getErd,
  text: (m) => [
    `${m.product}: ${m.boxes.length} boxes · ${m.lines.length} lines`,
    ...m.boxes.map((b) => `  ${b.kind} ${b.id} ${b.title}${b.root ? ' (root)' : ''}${b.empty ? ' (empty)' : ''}`),
    ...m.lines.map((l) => `  ${l.source} ${l.relation} ${l.target}`),
  ].join('\n'),
};

/** The ERD read's queries, as the CLI and the MCP server register them. */
export const ERD_QUERIES: readonly AnyQuery[] = [GET_ERD];
