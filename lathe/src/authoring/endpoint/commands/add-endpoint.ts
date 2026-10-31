import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EndpointRow } from '../../../platform/data/tables.ts';
import { ENDPOINT_SLICE, newEndpoint } from '../model.ts';
import { EndpointRepository } from '../repository.ts';

/** A new endpoint. */
export type AddEndpoint = Pick<EndpointRow, 'id' | 'title' | 'method' | 'route' | 'description' | 'command_id' | 'query_id' | 'notes'>;

export const ADD_ENDPOINT: CommandDefinition<AddEndpoint> = {
  id: 'LA-AUT-CMD320',
  slice: ENDPOINT_SLICE,
  name: 'add-endpoint',
  description: 'Adds an endpoint under the one command or query it exposes (exactly one of command_id and query_id), titled by its method and route.',
  method: 'POST',
  route: '/api/endpoint/add-endpoint',
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
};

/** Adds the endpoint, new and whole. */
export function addEndpoint(tx: Transaction, input: AddEndpoint): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.create(newEndpoint(input));
  endpoints.save(endpoint);
}
