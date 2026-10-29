// Remove a read model (LA-AUT-CMD287): Removes a read model whole: its fields, queries with their handlers and its projection, and the links they start. Refused while anything outside it references what is in it, such as its table or a flow step that invokes a query.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { READ_MODEL_SLICE } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';

/** The read model to remove. */
export type RemoveReadModel = { id: string };

/** Remove a read model (LA-AUT-CMD287). */
export const REMOVE_READ_MODEL: CommandDefinition<RemoveReadModel> = {
  id: 'LA-AUT-CMD287',
  slice: READ_MODEL_SLICE,
  name: 'remove-read-model',
  description: 'Removes a read model whole: its fields, queries with their handlers and its projection, and the links they start. Refused while anything outside it references what is in it, such as its table or a flow step that invokes a query.',
  method: 'POST',
  route: '/api/read-model/remove-read-model',
  input: {
    id: column('read_model', 'id', 'required'),
  },
  handler: removeReadModel,
};

/** Removes the read model whole. */
export function removeReadModel(tx: Transaction, input: RemoveReadModel): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.id) ?? tx.refuse('missing', `there is no read model ${input.id}`);
  readModels.remove(readModel);
}
