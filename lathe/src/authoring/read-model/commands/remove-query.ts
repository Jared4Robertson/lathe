import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { READ_MODEL_SLICE } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';

/** The query to remove. */
export type RemoveQuery = { id: string };

export const REMOVE_QUERY: CommandDefinition<RemoveQuery> = {
  id: 'LA-AUT-CMD290',
  slice: READ_MODEL_SLICE,
  name: 'remove-query',
  description: 'Removes a query with its handler and the links they start. Refused while anything else references them, such as a flow step that invokes it or its endpoint.',
  method: 'POST',
  route: '/api/read-model/remove-query',
  input: {
    id: column('query', 'id', 'required'),
  },
  handler: removeQuery,
};

/** Removes the query and its handler from their read model. */
export function removeQuery(tx: Transaction, input: RemoveQuery): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('query', input.id) ?? tx.refuse('missing', `there is no query ${input.id}`);
  readModel.queries = readModel.queries.filter((q) => q.row.id !== input.id);
  readModel.queryHandlers = readModel.queryHandlers.filter((h) => h.row.query_id !== input.id);
  readModels.save(readModel);
}
