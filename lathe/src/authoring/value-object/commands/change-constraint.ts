import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ConstraintRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { ValueObjectRepository } from '../repository.ts';
import { CHANGE_CONSTRAINT_IDENTITY } from './identities.generated.ts';

/** The constraint's changes: a column given is set. */
export type ChangeConstraint = Pick<ConstraintRow, 'id'> & { title?: ConstraintRow['title']; statement?: ConstraintRow['statement'] };

export const CHANGE_CONSTRAINT: CommandDefinition<ChangeConstraint> = {
  ...CHANGE_CONSTRAINT_IDENTITY,
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
