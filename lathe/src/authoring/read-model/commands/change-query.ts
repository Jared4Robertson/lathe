import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { QueryRow } from '../../../platform/data/tables.ts';
import { CHANGE_QUERY_IDENTITY } from './identities.generated.ts';
import { changeQuery } from './handlers.generated.ts';

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
