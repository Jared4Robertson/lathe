// The File facts read (LA-TRC-RM05): a product's addresses traced both ways, answered from the read model through its
// reader (reader.ts). The addresses are traced by the checks' run, so the query says it reads the run (`checked`): the
// server gives it the run it keeps for the data, the CLI and the MCP tool run the checks first. Its handler never sees
// the data and changes nothing. This slice holds only the read, so it names its read model where an aggregate's slice
// names its aggregate.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { TracedAddresses } from './read-model.ts';
import { fileFactsReader, type FileFactsReader } from './reader.ts';
import { LIST_TRACED_ADDRESSES_IDENTITY } from './queries.generated.ts';

/** A product's addresses traced both ways. */
export interface ProductAddresses extends TracedAddresses {
  product: string;
}

/** The product's addresses its files do not name, and those its code serves that no record has. */
export function listTracedAddresses(reader: FileFactsReader, input: { product_id: string }): ProductAddresses {
  const traced = reader.addressesOf(input.product_id);
  if (!traced) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return { product: input.product_id, ...traced };
}

/** List addresses traced both ways (LA-TRC-QRY08). */
export const LIST_TRACED_ADDRESSES: QueryDefinition<{ product_id: string }, ProductAddresses, FileFactsReader> = {
  ...LIST_TRACED_ADDRESSES_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  checked: true,
  reader: fileFactsReader,
  run: listTracedAddresses,
  text: (p) =>
    [
      `${p.product}: ${p.unnamed.length} address${p.unnamed.length === 1 ? '' : 'es'} not named in its files · ${p.unrecorded.length} served with no record`,
      ...p.unnamed.map((a) => `  ${a.record}: ${a.message}`),
      ...p.unrecorded.map((m) => `  ${m}`),
    ].join('\n'),
};
