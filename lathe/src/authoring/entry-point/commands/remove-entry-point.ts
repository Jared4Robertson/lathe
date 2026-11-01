import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { EntryPointRepository } from '../repository.ts';
import { REMOVE_ENTRY_POINT_IDENTITY } from './identities.generated.ts';

/** The entry point to remove. */
export type RemoveEntryPoint = { id: string };

export const REMOVE_ENTRY_POINT: CommandDefinition<RemoveEntryPoint> = {
  ...REMOVE_ENTRY_POINT_IDENTITY,
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
