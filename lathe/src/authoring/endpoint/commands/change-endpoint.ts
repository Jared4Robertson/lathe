import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { EndpointRow } from '../../../platform/data/tables.ts';
import { CHANGE_ENDPOINT_IDENTITY } from './identities.generated.ts';
import { changeEndpoint } from './handlers.generated.ts';

/** The endpoint's changes: a column given is set, null clears an optional one. */
export type ChangeEndpoint = Pick<EndpointRow, 'id'> & { title?: EndpointRow['title']; method?: EndpointRow['method']; route?: EndpointRow['route']; description?: EndpointRow['description']; notes?: EndpointRow['notes'] | null };

export const CHANGE_ENDPOINT = {
  ...CHANGE_ENDPOINT_IDENTITY,
  input: {
    id: column('endpoint', 'id', 'required'),
    title: column('endpoint', 'title', 'optional'),
    method: column('endpoint', 'method', 'optional'),
    route: column('endpoint', 'route', 'optional'),
    description: column('endpoint', 'description', 'optional'),
    notes: column('endpoint', 'notes', 'clearable'),
  },
  handler: changeEndpoint,
} satisfies CommandDefinition<ChangeEndpoint>;
