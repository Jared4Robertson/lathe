// The Record summaries read (LA-EXP-RM01): every record of a product's space as its pages name it, and the links among
// them, answered from the read model through its reader (reader.ts). Its handler never sees the data and changes
// nothing. This slice holds only the read, so it names its read model where an aggregate's slice names its aggregate.
import { id, type AnyQuery, type QueryDefinition, type Slice } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { RecordSummaries } from './read-model.ts';
import { recordSummariesReader, type RecordSummariesReader } from './reader.ts';

/** How the interfaces reach the Record summaries read: `lathe record-summaries`, the record_summaries_ tools, /api/record-summaries/. */
const RECORD_SUMMARIES_SLICE: Slice = { aggregate: 'LA-EXP-RM01', name: 'record-summaries' };

/** The records of the product's space, each as its pages name it, and the links among them. */
export function listRecordSummaries(reader: RecordSummariesReader, input: { product_id: string }): RecordSummaries {
  const summaries = reader.summariesOf(input.product_id);
  if (!summaries) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return summaries;
}

/** List a product's record summaries (LA-EXP-QRY01). */
export const LIST_RECORD_SUMMARIES: QueryDefinition<{ product_id: string }, RecordSummaries, RecordSummariesReader> = {
  id: 'LA-EXP-QRY01',
  slice: RECORD_SUMMARIES_SLICE,
  name: 'list-record-summaries',
  method: 'GET',
  route: '/api/record-summaries/list-record-summaries',
  description: "Lists every record of a product's space (its own and those of no product) as its pages name it: its kind, title, parent, product and domain, its group heading, a test's state, its data file and line and a digest of its rows; and the links among them.",
  input: { product_id: id('The product.', 'required') },
  reader: recordSummariesReader,
  run: listRecordSummaries,
  text: (s) =>
    [
      `${s.product}: ${s.records.length} record${s.records.length === 1 ? '' : 's'} · ${s.links.length} link${s.links.length === 1 ? '' : 's'}`,
      ...s.records.map((values) => `  ${['id', 'kind', 'title'].map((column) => values[s.columns.indexOf(column as never)]).join(' ')}`),
    ].join('\n'),
};

/** The Record summaries read's queries, as the CLI and the MCP server register them. */
export const RECORD_SUMMARIES_QUERIES: readonly AnyQuery[] = [LIST_RECORD_SUMMARIES];
