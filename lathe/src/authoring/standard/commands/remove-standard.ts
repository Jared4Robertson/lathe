import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { StandardRepository } from '../repository.ts';
import { REMOVE_STANDARD_IDENTITY } from './identities.generated.ts';

/** The standard to remove. */
export type RemoveStandard = { id: string };

export const REMOVE_STANDARD: CommandDefinition<RemoveStandard> = {
  ...REMOVE_STANDARD_IDENTITY,
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
