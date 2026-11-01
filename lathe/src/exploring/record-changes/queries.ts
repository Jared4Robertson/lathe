// The Record changes read (LA-EXP-RM07): what changed in a product's records since a baseline, answered from the read
// model through its reader (reader.ts). The baseline is git's, so the server reads it for the query's `since` before
// the query runs and gives it with the data (its definition says `baseline`). Its handler never sees the data and changes
// nothing. This slice holds only the read, so it names its read model where an aggregate's slice names its aggregate.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ProductChanges } from './read-model.ts';
import { recordChangesReader, type RecordChangesReader } from './reader.ts';
import { LIST_RECORD_CHANGES_IDENTITY } from './queries.generated.ts';

/** The product's changes since the baseline its `since` names. */
export function listRecordChanges(reader: RecordChangesReader, input: { product_id: string; since: string }): ProductChanges {
  const changes = reader.changesOf(input.product_id);
  if (!changes) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return changes;
}

/** Get what changed since a baseline (LA-EXP-QRY13). */
export const LIST_RECORD_CHANGES: QueryDefinition<{ product_id: string; since: string }, ProductChanges, RecordChangesReader> = {
  ...LIST_RECORD_CHANGES_IDENTITY,
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
