import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { StandardRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { StandardRepository } from '../repository.ts';
import { CHANGE_STANDARD_IDENTITY } from './identities.generated.ts';

/** The standard's changes: a column given is set. */
export type ChangeStandard = Pick<StandardRow, 'id'> & { title?: StandardRow['title']; type?: StandardRow['type']; description?: StandardRow['description'] };

export const CHANGE_STANDARD = {
  ...CHANGE_STANDARD_IDENTITY,
  input: {
    id: column('standard', 'id', 'required'),
    title: column('standard', 'title', 'optional'),
    type: column('standard', 'type', 'optional'),
    description: column('standard', 'description', 'optional'),
  },
  handler: changeStandard,
} satisfies CommandDefinition<ChangeStandard>;

/** Changes the standard's columns. */
export function changeStandard(tx: Transaction, input: ChangeStandard): void {
  const standards = new StandardRepository(tx);
  const standard = standards.load(input.id) ?? tx.refuse('missing', `there is no standard ${input.id}`);
  standard.standard = changed(standard.standard, input, ['title', 'type', 'description']);
  standards.save(standard);
}
