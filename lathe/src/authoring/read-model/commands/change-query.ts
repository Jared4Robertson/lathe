import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { QueryRow } from '../../../platform/data/tables.ts';
import { READ_MODEL_SLICE, changed } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The query's changes: a column given is set; a list given replaces the list. */
export type ChangeQuery = Pick<QueryRow, 'id'> & { title?: QueryRow['title']; description?: QueryRow['description']; selects_by?: string[]; calls?: string[] };

export const CHANGE_QUERY: CommandDefinition<ChangeQuery> = {
  id: 'LA-AUT-CMD289',
  slice: READ_MODEL_SLICE,
  name: 'change-query',
  description: "Changes a query's title or description, or the specifications it selects by or domain services it calls (each the whole list). Its read model never changes.",
  method: 'POST',
  route: '/api/read-model/change-query',
  input: {
    id: column('query', 'id', 'required'),
    title: column('query', 'title', 'optional'),
    description: column('query', 'description', 'optional'),
    selects_by: ids('The specifications it selects by, of its own domain. Replaces the list.', 'optional'),
    calls: ids('The domain services it calls, of its own domain. Replaces the list.', 'optional'),
  },
  handler: changeQuery,
};

/** Changes the query's columns and links. */
export function changeQuery(tx: Transaction, input: ChangeQuery): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('query', input.id) ?? tx.refuse('missing', `there is no query ${input.id}`);
  readModel.queries = readModel.queries.map((q) => (q.row.id === input.id ? { row: changed(q.row, input, ['title', 'description']), selectsBy: input.selects_by ?? q.selectsBy, calls: input.calls ?? q.calls } : q));
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
