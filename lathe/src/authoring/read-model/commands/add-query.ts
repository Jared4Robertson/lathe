import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { QueryRow } from '../../../platform/data/tables.ts';
import { READ_MODEL_SLICE } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export type AddQuery = Pick<QueryRow, 'id' | 'title' | 'read_model_id' | 'description'> & { selects_by?: string[]; calls?: string[] };

export const ADD_QUERY: CommandDefinition<AddQuery> = {
  id: 'LA-AUT-CMD288',
  slice: READ_MODEL_SLICE,
  name: 'add-query',
  description: 'Adds a query to the read model it reads, with the specifications it selects by and the domain services it calls.',
  method: 'POST',
  route: '/api/read-model/add-query',
  input: {
    id: column('query', 'id', 'required'),
    title: column('query', 'title', 'required'),
    read_model_id: column('query', 'read_model_id', 'required'),
    description: column('query', 'description', 'required'),
    selects_by: ids('The specifications it selects by, of its own domain.', 'optional'),
    calls: ids('The domain services it calls, of its own domain.', 'optional'),
  },
  handler: addQuery,
};

/** Adds the query to its read model. */
export function addQuery(tx: Transaction, input: AddQuery): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.read_model_id) ?? tx.refuse('missing', `there is no read model ${input.read_model_id}`);
  const { selects_by = [], calls = [], ...row } = input;
  readModel.queries.push({ row, selectsBy: selects_by, calls });
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
