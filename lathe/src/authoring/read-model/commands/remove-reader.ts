import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { READ_MODEL_SLICE } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';

/** The reader to remove. */
export type RemoveReader = { id: string };

export const REMOVE_READER: CommandDefinition<RemoveReader> = {
  id: 'LA-AUT-CMD299',
  slice: READ_MODEL_SLICE,
  name: 'remove-reader',
  description: "Removes a read model's reader with the links it starts and the packages it uses. Refused while anything references it.",
  method: 'POST',
  route: '/api/read-model/remove-reader',
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
