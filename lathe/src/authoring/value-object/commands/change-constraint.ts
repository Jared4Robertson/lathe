import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ConstraintRow } from '../../../platform/data/tables.ts';
import { VALUE_OBJECT_SLICE, changed } from '../model.ts';
import { ValueObjectRepository } from '../repository.ts';

/** The constraint's changes: a column given is set. */
export type ChangeConstraint = Pick<ConstraintRow, 'id'> & { title?: ConstraintRow['title']; statement?: ConstraintRow['statement'] };

export const CHANGE_CONSTRAINT: CommandDefinition<ChangeConstraint> = {
  id: 'LA-AUT-CMD274',
  slice: VALUE_OBJECT_SLICE,
  name: 'change-constraint',
  description: "Changes a constraint's title or statement. Its value object never changes.",
  method: 'POST',
  route: '/api/value-object/change-constraint',
  input: {
    id: column('constraint', 'id', 'required'),
    title: column('constraint', 'title', 'optional'),
    statement: column('constraint', 'statement', 'optional'),
  },
  handler: changeConstraint,
};

/** Changes the constraint's columns. */
export function changeConstraint(tx: Transaction, input: ChangeConstraint): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('constraint', input.id) ?? tx.refuse('missing', `there is no constraint ${input.id}`);
  valueObject.constraints = valueObject.constraints.map((c) => (c.id === input.id ? changed(c, input, ['title', 'statement']) : c));
  valueObjects.save(valueObject);
}
