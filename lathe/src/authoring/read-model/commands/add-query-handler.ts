// Add a query handler (LA-AUT-CMD294): Adds the handler that answers a query, its one piece of code, with the standard rules it meets and the packages it uses.
import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { QueryHandlerRow } from '../../../platform/data/tables.ts';
import { READ_MODEL_SLICE } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new query handler, with the standard rules it meets and the packages it uses. */
export type AddQueryHandler = Pick<QueryHandlerRow, 'id' | 'title' | 'query_id' | 'file' | 'description'> & { meets?: string[]; packages?: string[] };

/** Add a query handler (LA-AUT-CMD294). */
export const ADD_QUERY_HANDLER: CommandDefinition<AddQueryHandler> = {
  id: 'LA-AUT-CMD294',
  slice: READ_MODEL_SLICE,
  name: 'add-query-handler',
  description: 'Adds the handler that answers a query, its one piece of code, with the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/read-model/add-query-handler',
  input: {
    id: column('query_handler', 'id', 'required'),
    title: column('query_handler', 'title', 'required'),
    query_id: column('query_handler', 'query_id', 'required'),
    file: column('query_handler', 'file', 'optional'),
    description: column('query_handler', 'description', 'required'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
  },
  handler: addQueryHandler,
};

/** Adds the handler to its query, which has none yet. */
export function addQueryHandler(tx: Transaction, input: AddQueryHandler): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('query', input.query_id) ?? tx.refuse('missing', `there is no query ${input.query_id}`);
  const existing = readModel.queryHandlers.find((h) => h.row.query_id === input.query_id);
  if (existing) tx.refuse('exists', `${input.query_id} already has its query handler, ${existing.row.id}`);
  const { meets = [], packages = [], ...row } = input;
  readModel.queryHandlers.push({ row, meets, packages });
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
