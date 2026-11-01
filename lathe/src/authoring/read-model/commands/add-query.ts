import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { QueryRow } from '../../../platform/data/tables.ts';
import { ReadModelRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_QUERY_IDENTITY } from './identities.generated.ts';

export type AddQuery = Pick<QueryRow, 'id' | 'title' | 'read_model_id' | 'description'> & { selects_by?: string[]; calls?: string[] };

export const ADD_QUERY = {
  ...ADD_QUERY_IDENTITY,
  input: {
    id: column('query', 'id', 'required'),
    title: column('query', 'title', 'required'),
    read_model_id: column('query', 'read_model_id', 'required'),
    description: column('query', 'description', 'required'),
    selects_by: ids('The specifications it selects by, of its own domain.', 'optional'),
    calls: ids('The domain services it calls, of its own domain.', 'optional'),
  },
  handler: addQuery,
} satisfies CommandDefinition<AddQuery>;

/** Adds the query to its read model. */
export function addQuery(tx: Transaction, input: AddQuery): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.read_model_id) ?? tx.refuse('missing', `there is no read model ${input.read_model_id}`);
  const { selects_by = [], calls = [], ...row } = input;
  readModel.queries.push({ row, selectsBy: selects_by, calls });
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
