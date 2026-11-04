import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { EndpointHandlerRow } from '../../../platform/data/tables.ts';
import { ADD_ENDPOINT_HANDLER_IDENTITY } from './identities.generated.ts';
import { addEndpointHandler } from './handlers.generated.ts';

export type AddEndpointHandler = Pick<EndpointHandlerRow, 'id' | 'title' | 'endpoint_id' | 'description' | 'file'> & { meets?: string[]; packages?: string[]; helpers?: string[] };

export const ADD_ENDPOINT_HANDLER = {
  ...ADD_ENDPOINT_HANDLER_IDENTITY,
  input: {
    id: column('endpoint_handler', 'id', 'required'),
    title: column('endpoint_handler', 'title', 'required'),
    endpoint_id: column('endpoint_handler', 'endpoint_id', 'required'),
    description: column('endpoint_handler', 'description', 'required'),
    file: column('endpoint_handler', 'file', 'optional'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts("The packages it uses, each listed in one of the product's package.json files.", 'optional'),
    helpers: texts('The helper files its code is split across beside its file, such as helpers and build-tag variants, each from the product root; no other record names one.', 'optional'),
  },
  handler: addEndpointHandler,
} satisfies CommandDefinition<AddEndpointHandler>;
