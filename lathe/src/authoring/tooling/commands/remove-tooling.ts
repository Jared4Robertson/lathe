import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { TOOLING_SLICE } from '../model.ts';
import { ToolingRepository } from '../repository.ts';

/** The tooling record to remove. */
export type RemoveTooling = { id: string };

export const REMOVE_TOOLING: CommandDefinition<RemoveTooling> = {
  id: 'LA-AUT-CMD157',
  slice: TOOLING_SLICE,
  name: 'remove-tooling',
  description: 'Removes a tooling record whole, with the packages it names and the links it starts. Refused while anything references it.',
  method: 'POST',
  route: '/api/tooling/remove-tooling',
  input: {
    id: column('tooling', 'id', 'required'),
  },
  handler: removeTooling,
};

/** Removes the tooling record whole. */
export function removeTooling(tx: Transaction, input: RemoveTooling): void {
  const records = new ToolingRepository(tx);
  const record = records.load(input.id) ?? tx.refuse('missing', `there is no tooling ${input.id}`);
  records.remove(record);
}
