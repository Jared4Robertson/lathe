import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ConstraintRow } from '../../../platform/data/tables.ts';
import { ADD_CONSTRAINT_IDENTITY } from './identities.generated.ts';
import { addConstraint } from './handlers.generated.ts';

/** A new constraint. */
export type AddConstraint = Pick<ConstraintRow, 'id' | 'title' | 'value_object_id' | 'statement'>;

export const ADD_CONSTRAINT = {
  ...ADD_CONSTRAINT_IDENTITY,
  input: {
    id: column('constraint', 'id', 'required'),
    title: column('constraint', 'title', 'required'),
    value_object_id: column('constraint', 'value_object_id', 'required'),
    statement: column('constraint', 'statement', 'required'),
  },
  handler: addConstraint,
} satisfies CommandDefinition<AddConstraint>;
