import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { InvariantRow } from '../../../platform/data/tables.ts';
import { ADD_INVARIANT_IDENTITY } from './identities.generated.ts';
import { addInvariant } from './handlers.generated.ts';

/** A new invariant. */
export type AddInvariant = Pick<InvariantRow, 'id' | 'title' | 'aggregate_id' | 'statement'>;

export const ADD_INVARIANT = {
  ...ADD_INVARIANT_IDENTITY,
  input: {
    id: column('invariant', 'id', 'required'),
    title: column('invariant', 'title', 'required'),
    aggregate_id: column('invariant', 'aggregate_id', 'required'),
    statement: column('invariant', 'statement', 'required'),
  },
  handler: addInvariant,
} satisfies CommandDefinition<AddInvariant>;
