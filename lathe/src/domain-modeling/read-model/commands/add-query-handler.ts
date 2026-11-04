import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { QueryHandlerRow } from '../../../platform/data/tables.ts';
import { ADD_QUERY_HANDLER_IDENTITY } from './identities.generated.ts';
import { addQueryHandler } from './handlers.generated.ts';

export type AddQueryHandler = Pick<QueryHandlerRow, 'id' | 'title' | 'query_id' | 'file' | 'description'> & { meets?: string[]; packages?: string[]; helpers?: string[] };

export const ADD_QUERY_HANDLER = {
  ...ADD_QUERY_HANDLER_IDENTITY,
  input: {
    id: column('query_handler', 'id', 'required'),
    title: column('query_handler', 'title', 'required'),
    query_id: column('query_handler', 'query_id', 'required'),
    file: column('query_handler', 'file', 'optional'),
    description: column('query_handler', 'description', 'required'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
    helpers: texts('The helper files its code is split across beside its file, such as helpers and build-tag variants, each from the product root; no other record names one.', 'optional'),
  },
  handler: addQueryHandler,
} satisfies CommandDefinition<AddQueryHandler>;
