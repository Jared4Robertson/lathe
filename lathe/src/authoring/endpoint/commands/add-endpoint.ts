import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { EndpointRow } from '../../../platform/data/tables.ts';
import { ADD_ENDPOINT_IDENTITY } from './identities.generated.ts';
import { addEndpoint } from './handlers.generated.ts';

/** A new endpoint. */
export type AddEndpoint = Pick<EndpointRow, 'id' | 'title' | 'method' | 'route' | 'description' | 'command_id' | 'query_id' | 'notes'>;

export const ADD_ENDPOINT = {
  ...ADD_ENDPOINT_IDENTITY,
  input: {
    id: column('endpoint', 'id', 'required'),
    title: column('endpoint', 'title', 'required'),
    method: column('endpoint', 'method', 'required'),
    route: column('endpoint', 'route', 'required'),
    description: column('endpoint', 'description', 'required'),
    command_id: column('endpoint', 'command_id', 'optional'),
    query_id: column('endpoint', 'query_id', 'optional'),
    notes: column('endpoint', 'notes', 'optional'),
  },
  handler: addEndpoint,
} satisfies CommandDefinition<AddEndpoint>;
