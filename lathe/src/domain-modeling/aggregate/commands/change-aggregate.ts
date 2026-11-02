import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { AggregateRow } from '../../../platform/data/tables.ts';
import { CHANGE_AGGREGATE_IDENTITY } from './identities.generated.ts';
import { changeAggregate } from './handlers.generated.ts';

/** The aggregate's changes: a column given is set, null clears an optional one. */
export type ChangeAggregate = Pick<AggregateRow, 'id'> & { title?: string; description?: string; identity?: string; notes?: string | null };

export const CHANGE_AGGREGATE = {
  ...CHANGE_AGGREGATE_IDENTITY,
  input: {
    id: column('aggregate', 'id', 'required'),
    title: column('aggregate', 'title', 'optional'),
    description: column('aggregate', 'description', 'optional'),
    identity: column('aggregate', 'identity', 'optional'),
    notes: column('aggregate', 'notes', 'clearable'),
  },
  handler: changeAggregate,
} satisfies CommandDefinition<ChangeAggregate>;
