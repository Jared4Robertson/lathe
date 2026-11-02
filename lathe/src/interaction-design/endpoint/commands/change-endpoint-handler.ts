import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { EndpointHandlerRow } from '../../../platform/data/tables.ts';
import { CHANGE_ENDPOINT_HANDLER_IDENTITY } from './identities.generated.ts';
import { changeEndpointHandler } from './handlers.generated.ts';

/** The endpoint handler's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeEndpointHandler = Pick<EndpointHandlerRow, 'id'> & { title?: EndpointHandlerRow['title']; description?: EndpointHandlerRow['description']; file?: EndpointHandlerRow['file'] | null; meets?: string[]; packages?: string[] };

export const CHANGE_ENDPOINT_HANDLER = {
  ...CHANGE_ENDPOINT_HANDLER_IDENTITY,
  input: {
    id: column('endpoint_handler', 'id', 'required'),
    title: column('endpoint_handler', 'title', 'optional'),
    description: column('endpoint_handler', 'description', 'optional'),
    file: column('endpoint_handler', 'file', 'clearable'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
  },
  handler: changeEndpointHandler,
} satisfies CommandDefinition<ChangeEndpointHandler>;
