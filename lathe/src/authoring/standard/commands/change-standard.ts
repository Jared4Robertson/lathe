// Change a standard (LA-AUT-CMD201): Changes a standard's title or description. Its product never changes.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { StandardRow } from '../../../platform/data/tables.ts';
import { STANDARD_SLICE, changed } from '../model.ts';
import { StandardRepository } from '../repository.ts';

/** The standard's changes: a column given is set. */
export type ChangeStandard = Pick<StandardRow, 'id'> & { title?: StandardRow['title']; description?: StandardRow['description'] };

/** Change a standard (LA-AUT-CMD201). */
export const CHANGE_STANDARD: CommandDefinition<ChangeStandard> = {
  id: 'LA-AUT-CMD201',
  slice: STANDARD_SLICE,
  name: 'change-standard',
  description: "Changes a standard's title or description. Its product never changes.",
  method: 'POST',
  route: '/api/standard/change-standard',
  input: {
    id: column('standard', 'id', 'required'),
    title: column('standard', 'title', 'optional'),
    description: column('standard', 'description', 'optional'),
  },
  handler: changeStandard,
};

/** Changes the standard's columns. */
export function changeStandard(tx: Transaction, input: ChangeStandard): void {
  const standards = new StandardRepository(tx);
  const standard = standards.load(input.id) ?? tx.refuse('missing', `there is no standard ${input.id}`);
  standard.standard = changed(standard.standard, input, ['title', 'description']);
  standards.save(standard);
}
