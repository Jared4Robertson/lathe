import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { READ_MODEL_SLICE } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';

/** The query handler to remove. */
export type RemoveQueryHandler = { id: string };

export const REMOVE_QUERY_HANDLER: CommandDefinition<RemoveQueryHandler> = {
  id: 'LA-AUT-CMD296',
  slice: READ_MODEL_SLICE,
  name: 'remove-query-handler',
  description: "Removes a query's handler with the links it starts and the packages it uses. Refused while anything references it.",
  method: 'POST',
  route: '/api/read-model/remove-query-handler',
  input: {
    id: column('query_handler', 'id', 'required'),
  },
  handler: removeQueryHandler,
};

/** Removes the handler from its read model. */
export function removeQueryHandler(tx: Transaction, input: RemoveQueryHandler): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('query_handler', input.id) ?? tx.refuse('missing', `there is no query handler ${input.id}`);
  readModel.queryHandlers = readModel.queryHandlers.filter((h) => h.row.id !== input.id);
  readModels.save(readModel);
}
