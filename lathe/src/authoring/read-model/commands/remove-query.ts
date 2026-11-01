import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ReadModelRepository } from '../repository.ts';
import { REMOVE_QUERY_IDENTITY } from './identities.generated.ts';

/** The query to remove. */
export type RemoveQuery = { id: string };

export const REMOVE_QUERY = {
  ...REMOVE_QUERY_IDENTITY,
  input: {
    id: column('query', 'id', 'required'),
  },
  handler: removeQuery,
} satisfies CommandDefinition<RemoveQuery>;

/** Removes the query and its handler from their read model. */
export function removeQuery(tx: Transaction, input: RemoveQuery): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('query', input.id) ?? tx.refuse('missing', `there is no query ${input.id}`);
  readModel.queries = readModel.queries.filter((q) => q.row.id !== input.id);
  readModel.queryHandlers = readModel.queryHandlers.filter((h) => h.row.query_id !== input.id);
  readModels.save(readModel);
}
