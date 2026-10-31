import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ENTRY_POINT_SLICE } from '../model.ts';
import { EntryPointRepository } from '../repository.ts';

/** The entry point to remove. */
export type RemoveEntryPoint = { id: string };

export const REMOVE_ENTRY_POINT: CommandDefinition<RemoveEntryPoint> = {
  id: 'LA-AUT-CMD152',
  slice: ENTRY_POINT_SLICE,
  name: 'remove-entry-point',
  description: 'Removes an entry point whole, with the packages it names and the links it starts. Refused while anything references it.',
  method: 'POST',
  route: '/api/entry-point/remove-entry-point',
  input: {
    id: column('entry_point', 'id', 'required'),
  },
  handler: removeEntryPoint,
};

/** Removes the entry point whole. */
export function removeEntryPoint(tx: Transaction, input: RemoveEntryPoint): void {
  const records = new EntryPointRepository(tx);
  const record = records.load(input.id) ?? tx.refuse('missing', `there is no entry_point ${input.id}`);
  records.remove(record);
}
