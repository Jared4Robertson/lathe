import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ConstraintRow } from '../../../platform/data/tables.ts';
import { CHANGE_CONSTRAINT_IDENTITY } from './identities.generated.ts';
import { changeConstraint } from './handlers.generated.ts';

/** The constraint's changes: a column given is set. */
export type ChangeConstraint = Pick<ConstraintRow, 'id'> & { title?: ConstraintRow['title']; statement?: ConstraintRow['statement'] };

export const CHANGE_CONSTRAINT = {
  ...CHANGE_CONSTRAINT_IDENTITY,
  input: {
    id: column('constraint', 'id', 'required'),
    title: column('constraint', 'title', 'optional'),
    statement: column('constraint', 'statement', 'optional'),
  },
  handler: changeConstraint,
} satisfies CommandDefinition<ChangeConstraint>;
