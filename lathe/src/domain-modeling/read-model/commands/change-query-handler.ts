import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { QueryHandlerRow } from '../../../platform/data/tables.ts';
import { CHANGE_QUERY_HANDLER_IDENTITY } from './identities.generated.ts';
import { changeQueryHandler } from './handlers.generated.ts';

/** The query handler's changes: a column given is set, null clears an optional one; a list given replaces the list. */
export type ChangeQueryHandler = Pick<QueryHandlerRow, 'id'> & { title?: QueryHandlerRow['title']; file?: QueryHandlerRow['file'] | null; description?: QueryHandlerRow['description']; meets?: string[]; packages?: string[]; helpers?: string[] };

export const CHANGE_QUERY_HANDLER = {
  ...CHANGE_QUERY_HANDLER_IDENTITY,
  input: {
    id: column('query_handler', 'id', 'required'),
    title: column('query_handler', 'title', 'optional'),
    file: column('query_handler', 'file', 'clearable'),
    description: column('query_handler', 'description', 'optional'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files. Replaces the list.", 'optional'),
    helpers: texts('The helper files its code is split across beside its file, each from the product root. Replaces the list.', 'optional'),
  },
  handler: changeQueryHandler,
} satisfies CommandDefinition<ChangeQueryHandler>;
