import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { QueryRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_QUERY_IDENTITY } from './identities.generated.ts';

/** The query's changes: a column given is set; a list given replaces the list. */
export type ChangeQuery = Pick<QueryRow, 'id'> & { title?: QueryRow['title']; description?: QueryRow['description']; selects_by?: string[]; calls?: string[] };

export const CHANGE_QUERY = {
  ...CHANGE_QUERY_IDENTITY,
  input: {
    id: column('query', 'id', 'required'),
    title: column('query', 'title', 'optional'),
    description: column('query', 'description', 'optional'),
    selects_by: ids('The specifications it selects by, of its own domain. Replaces the list.', 'optional'),
    calls: ids('The domain services it calls, of its own domain. Replaces the list.', 'optional'),
  },
  handler: changeQuery,
} satisfies CommandDefinition<ChangeQuery>;

/** Changes the query's columns and links. */
export function changeQuery(tx: Transaction, input: ChangeQuery): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('query', input.id) ?? tx.refuse('missing', `there is no query ${input.id}`);
  readModel.queries = readModel.queries.map((q) => (q.row.id === input.id ? { row: changed(q.row, input, ['title', 'description']), selectsBy: input.selects_by ?? q.selectsBy, calls: input.calls ?? q.calls } : q));
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
