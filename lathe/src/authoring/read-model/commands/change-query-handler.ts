import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { QueryHandlerRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_QUERY_HANDLER_IDENTITY } from './identities.generated.ts';

/** The query handler's changes: a column given is set, null clears an optional one; a list given replaces the list. */
export type ChangeQueryHandler = Pick<QueryHandlerRow, 'id'> & { title?: QueryHandlerRow['title']; file?: QueryHandlerRow['file'] | null; description?: QueryHandlerRow['description']; meets?: string[]; packages?: string[] };

export const CHANGE_QUERY_HANDLER = {
  ...CHANGE_QUERY_HANDLER_IDENTITY,
  input: {
    id: column('query_handler', 'id', 'required'),
    title: column('query_handler', 'title', 'optional'),
    file: column('query_handler', 'file', 'clearable'),
    description: column('query_handler', 'description', 'optional'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files. Replaces the list.", 'optional'),
  },
  handler: changeQueryHandler,
} satisfies CommandDefinition<ChangeQueryHandler>;

/** Changes the query handler's columns, links and packages. */
export function changeQueryHandler(tx: Transaction, input: ChangeQueryHandler): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('query_handler', input.id) ?? tx.refuse('missing', `there is no query handler ${input.id}`);
  readModel.queryHandlers = readModel.queryHandlers.map((h) => (h.row.id === input.id ? { row: changed(h.row, input, ['title', 'file', 'description']), meets: input.meets ?? h.meets, packages: input.packages ?? h.packages } : h));
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
