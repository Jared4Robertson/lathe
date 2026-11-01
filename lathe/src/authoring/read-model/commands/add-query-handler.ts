import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { QueryHandlerRow } from '../../../platform/data/tables.ts';
import { ReadModelRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_QUERY_HANDLER_IDENTITY } from './identities.generated.ts';

export type AddQueryHandler = Pick<QueryHandlerRow, 'id' | 'title' | 'query_id' | 'file' | 'description'> & { meets?: string[]; packages?: string[] };

export const ADD_QUERY_HANDLER: CommandDefinition<AddQueryHandler> = {
  ...ADD_QUERY_HANDLER_IDENTITY,
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
  const { meets = [], packages = [], ...row } = input;
  readModel.queryHandlers.push({ row, meets, packages });
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
