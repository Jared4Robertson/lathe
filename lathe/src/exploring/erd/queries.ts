// The ERD read (LA-EXP-RM04): a product's one entity-relationship diagram, which the ERD stage lays out and draws,
// answered from the read model through its reader (reader.ts). Its handler never sees the data and changes nothing.
// This slice holds only the read, so it names its read model where an aggregate's slice names its aggregate.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ErdMap } from './read-model.ts';
import { erdReader, type ErdReader } from './reader.ts';
import { GET_ERD_IDENTITY } from './queries.generated.ts';

/** The product's map: its domains, aggregates and entities, and the lines between them. */
export function getErd(reader: ErdReader, input: { product_id: string }): ErdMap {
  const map = reader.mapOf(input.product_id);
  if (!map) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return map;
}

/** Get the ERD map (LA-EXP-QRY10). */
export const GET_ERD: QueryDefinition<{ product_id: string }, ErdMap, ErdReader> = {
  ...GET_ERD_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  reader: erdReader,
  run: getErd,
  text: (m) => [
    `${m.product}: ${m.boxes.length} boxes · ${m.lines.length} lines`,
    ...m.boxes.map((b) => `  ${b.kind} ${b.id} ${b.title}${b.root ? ' (root)' : ''}${b.empty ? ' (empty)' : ''}`),
    ...m.lines.map((l) => `  ${l.source} ${l.relation} ${l.target}`),
  ].join('\n'),
};
