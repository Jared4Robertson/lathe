// Remove a projection (LA-AUT-CMD293): Removes a read model's projection with the links it starts and the packages it uses. Refused while anything references it.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { READ_MODEL_SLICE } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';

/** The projection to remove. */
export type RemoveProjection = { id: string };

/** Remove a projection (LA-AUT-CMD293). */
export const REMOVE_PROJECTION: CommandDefinition<RemoveProjection> = {
  id: 'LA-AUT-CMD293',
  slice: READ_MODEL_SLICE,
  name: 'remove-projection',
  description: "Removes a read model's projection with the links it starts and the packages it uses. Refused while anything references it.",
  method: 'POST',
  route: '/api/read-model/remove-projection',
  input: {
    id: column('projection', 'id', 'required'),
  },
  handler: removeProjection,
};

/** Removes the projection from its read model. */
export function removeProjection(tx: Transaction, input: RemoveProjection): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('projection', input.id) ?? tx.refuse('missing', `there is no projection ${input.id}`);
  readModel.projection = null;
  readModels.save(readModel);
}
