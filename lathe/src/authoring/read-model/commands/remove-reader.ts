import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ReadModelRepository } from '../repository.ts';
import { REMOVE_READER_IDENTITY } from './identities.generated.ts';

/** The reader to remove. */
export type RemoveReader = { id: string };

export const REMOVE_READER: CommandDefinition<RemoveReader> = {
  ...REMOVE_READER_IDENTITY,
  input: {
    id: column('reader', 'id', 'required'),
  },
  handler: removeReader,
};

/** Removes the reader from its read model. */
export function removeReader(tx: Transaction, input: RemoveReader): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('reader', input.id) ?? tx.refuse('missing', `there is no reader ${input.id}`);
  readModel.reader = null;
  readModels.save(readModel);
}
