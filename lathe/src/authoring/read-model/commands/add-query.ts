import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { QueryRow } from '../../../platform/data/tables.ts';
import { ADD_QUERY_IDENTITY } from './identities.generated.ts';
import { addQuery } from './handlers.generated.ts';

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
