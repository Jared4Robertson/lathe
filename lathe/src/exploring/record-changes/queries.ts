// The Record changes read (LA-EXP-RM07): what changed in a product's records since a baseline, answered from the read
// model through its reader (reader.ts). The baseline is git's, so the server reads it for the query's `since` before
// the query runs and gives it with the data (its definition says `baseline`). Its handler never sees the data and changes
// nothing. This slice holds only the read, so it names its read model where an aggregate's slice names its aggregate.
import { id, type AnyQuery, type QueryDefinition, type Slice } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ProductChanges } from './read-model.ts';
import { recordChangesReader, type RecordChangesReader } from './reader.ts';

/** How the interfaces reach the Record changes read: `lathe record-changes`, the record_changes_ tools, /api/record-changes/. */
const RECORD_CHANGES_SLICE: Slice = { aggregate: 'LA-EXP-RM07', name: 'record-changes' };

/** The product's changes since the baseline its `since` names. */
export function listRecordChanges(reader: RecordChangesReader, input: { product_id: string; since: string }): ProductChanges {
  const changes = reader.changesOf(input.product_id);
  if (!changes) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return changes;
}

/** Get what changed since a baseline (LA-EXP-QRY13). */
export const LIST_RECORD_CHANGES: QueryDefinition<{ product_id: string; since: string }, ProductChanges, RecordChangesReader> = {
  id: 'LA-EXP-QRY13',
  slice: RECORD_CHANGES_SLICE,
  name: 'list-record-changes',
  method: 'GET',
  route: '/api/record-changes/list-record-changes',
  description: "Lists the records that differ between a product's baseline (the last commit with `commit`, where the branch left the default branch with `branch`, or a commit's hash) and its data now: each added, removed or changed, with the columns of its own row that changed, its part rows and the links it starts.",
  input: {
    product_id: id('The product.', 'required'),
    since: id('The baseline: commit (the last commit), branch (where the branch left the default branch) or a commit hash.', 'required'),
  },
  baseline: true,
  reader: recordChangesReader,
  run: listRecordChanges,
  text: (p) =>
    [
      `${p.product}: ${p.baseline.state === 'ok' ? `since ${p.baseline.short} ${p.baseline.subject}` : p.baseline.message}`,
      ...p.changes.map((c) => `  ${c.change} ${c.id} ${c.title}`),
    ].join('\n'),
};

/** The Record changes read's queries, as the CLI and the MCP server register them. */
export const RECORD_CHANGES_QUERIES: readonly AnyQuery[] = [LIST_RECORD_CHANGES];
