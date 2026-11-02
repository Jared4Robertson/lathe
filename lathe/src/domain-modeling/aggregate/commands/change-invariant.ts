import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { InvariantRow } from '../../../platform/data/tables.ts';
import { CHANGE_INVARIANT_IDENTITY } from './identities.generated.ts';
import { changeInvariant } from './handlers.generated.ts';

/** The invariant's changes: a column given is set. */
export type ChangeInvariant = Pick<InvariantRow, 'id'> & { title?: string; statement?: string };

export const CHANGE_INVARIANT = {
  ...CHANGE_INVARIANT_IDENTITY,
  input: {
    id: column('invariant', 'id', 'required'),
    title: column('invariant', 'title', 'optional'),
    statement: column('invariant', 'statement', 'optional'),
  },
  handler: changeInvariant,
} satisfies CommandDefinition<ChangeInvariant>;
