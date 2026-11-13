import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { AggregateRow } from '../../../platform/data/tables.ts';
import { ADD_AGGREGATE_IDENTITY } from './identities.generated.ts';
import { addAggregate } from './handlers.generated.ts';

/** A new aggregate: its row, and the business outcomes it serves. */
export type AddAggregate = Pick<AggregateRow, 'id' | 'title' | 'domain_id' | 'description' | 'identity' | 'notes'> & { serves?: string[] };

export const ADD_AGGREGATE = {
  ...ADD_AGGREGATE_IDENTITY,
  input: {
    id: column('aggregate', 'id', 'required'),
    title: column('aggregate', 'title', 'required'),
    domain_id: column('aggregate', 'domain_id', 'required'),
    description: column('aggregate', 'description', 'required'),
    identity: column('aggregate', 'identity', 'required'),
    notes: column('aggregate', 'notes', 'optional'),
    serves: ids('The business outcomes of its product it serves: those its use cases are for.', 'optional'),
  },
  handler: addAggregate,
} satisfies CommandDefinition<AddAggregate>;
