import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { STANDARD_SLICE } from '../model.ts';
import { StandardRepository } from '../repository.ts';

/** The standard to remove. */
export type RemoveStandard = { id: string };

export const REMOVE_STANDARD: CommandDefinition<RemoveStandard> = {
  id: 'LA-AUT-CMD202',
  slice: STANDARD_SLICE,
  name: 'remove-standard',
  description: 'Removes a standard whole: its rules and rule tests, and the links they start. Refused while anything outside it references what is in it, such as a technical record that meets a rule.',
  method: 'POST',
  route: '/api/standard/remove-standard',
  input: {
    id: column('standard', 'id', 'required'),
  },
  handler: removeStandard,
};

/** Removes the standard whole. */
export function removeStandard(tx: Transaction, input: RemoveStandard): void {
  const standards = new StandardRepository(tx);
  const standard = standards.load(input.id) ?? tx.refuse('missing', `there is no standard ${input.id}`);
  standards.remove(standard);
}
