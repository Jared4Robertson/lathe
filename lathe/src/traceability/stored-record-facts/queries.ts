// The Stored record facts read (LA-TRC-RM07): the stored kinds of a product whose files do not define them as the spec
// says, answered from the read model through its reader (reader.ts). The comparison is the checks' run's, so the query
// says it reads the run (`checked`): the server gives it the run it keeps for the data, the CLI and the MCP tool run the
// checks first. Its handler never sees the data and changes nothing. This slice holds only the read, so it names its
// read model where an aggregate's slice names its aggregate.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { UndefinedPart } from './read-model.ts';
import { storedRecordFactsReader, type StoredRecordFactsReader } from './reader.ts';
import { FIND_UNDEFINED_STORED_KINDS_IDENTITY } from './queries.generated.ts';

/** A product's stored kinds' parts their files do not define. */
export interface ProductUndefinedParts {
  product: string;
  parts: UndefinedPart[];
}

/** Each part of the product's stored kinds that the file it names does not define. */
export function findUndefinedStoredKinds(reader: StoredRecordFactsReader, input: { product_id: string }): ProductUndefinedParts {
  const parts = reader.undefinedOf(input.product_id);
  if (!parts) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return { product: input.product_id, parts };
}

/** Find the stored kinds their files do not define (LA-TRC-QRY09). */
export const FIND_UNDEFINED_STORED_KINDS: QueryDefinition<{ product_id: string }, ProductUndefinedParts, StoredRecordFactsReader> = {
  ...FIND_UNDEFINED_STORED_KINDS_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  checked: true,
  reader: storedRecordFactsReader,
  run: findUndefinedStoredKinds,
  text: (p) =>
    [`${p.product}: ${p.parts.length ? `${p.parts.length} part${p.parts.length === 1 ? '' : 's'} not defined` : 'every stored kind is defined as the spec says'}`, ...p.parts.map((x) => `  ${x.record}: ${x.message}`)].join('\n'),
};
