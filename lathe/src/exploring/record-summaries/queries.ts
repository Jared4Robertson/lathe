// The Record summaries read (LA-EXP-RM01): every record of a product's space as its pages name it, and the links among
// them, answered from the read model through its reader (reader.ts). Its handler never sees the data and changes
// nothing. This slice holds only the read, so it names its read model where an aggregate's slice names its aggregate.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { RecordSummaries } from './read-model.ts';
import { recordSummariesReader, type RecordSummariesReader } from './reader.ts';
import { LIST_RECORD_SUMMARIES_IDENTITY } from './queries.generated.ts';

/** The records of the product's space, each as its pages name it, and the links among them. */
export function listRecordSummaries(reader: RecordSummariesReader, input: { product_id: string }): RecordSummaries {
  const summaries = reader.summariesOf(input.product_id);
  if (!summaries) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return summaries;
}

/** List a product's record summaries (LA-EXP-QRY01). */
export const LIST_RECORD_SUMMARIES: QueryDefinition<{ product_id: string }, RecordSummaries, RecordSummariesReader> = {
  ...LIST_RECORD_SUMMARIES_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  reader: recordSummariesReader,
  run: listRecordSummaries,
  text: (s) =>
    [
      `${s.product}: ${s.records.length} record${s.records.length === 1 ? '' : 's'} · ${s.links.length} link${s.links.length === 1 ? '' : 's'}`,
      ...s.records.map((values) => `  ${['id', 'kind', 'title'].map((column) => values[s.columns.indexOf(column as never)]).join(' ')}`),
    ].join('\n'),
};
