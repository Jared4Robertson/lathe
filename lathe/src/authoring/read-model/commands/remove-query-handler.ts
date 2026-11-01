import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ReadModelRepository } from '../repository.ts';
import { REMOVE_QUERY_HANDLER_IDENTITY } from './identities.generated.ts';

/** The query handler to remove. */
export type RemoveQueryHandler = { id: string };

export const REMOVE_QUERY_HANDLER = {
  ...REMOVE_QUERY_HANDLER_IDENTITY,
  input: {
    id: column('query_handler', 'id', 'required'),
  },
  handler: removeQueryHandler,
} satisfies CommandDefinition<RemoveQueryHandler>;

/** Removes the handler from its read model. */
export function removeQueryHandler(tx: Transaction, input: RemoveQueryHandler): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('query_handler', input.id) ?? tx.refuse('missing', `there is no query handler ${input.id}`);
  readModel.queryHandlers = readModel.queryHandlers.filter((h) => h.row.id !== input.id);
  readModels.save(readModel);
}
