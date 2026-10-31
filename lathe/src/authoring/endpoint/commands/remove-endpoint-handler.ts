import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ENDPOINT_SLICE } from '../model.ts';
import { EndpointRepository } from '../repository.ts';

/** The endpoint handler to remove. */
export type RemoveEndpointHandler = { id: string };

export const REMOVE_ENDPOINT_HANDLER: CommandDefinition<RemoveEndpointHandler> = {
  id: 'LA-AUT-CMD329',
  slice: ENDPOINT_SLICE,
  name: 'remove-endpoint-handler',
  description: 'Removes an endpoint handler with the links it starts and the packages it uses. Refused while anything else references them.',
  method: 'POST',
  route: '/api/endpoint/remove-endpoint-handler',
  input: {
    id: column('endpoint_handler', 'id', 'required'),
  },
  handler: removeEndpointHandler,
};

/** Removes the endpoint handler from its endpoint. */
export function removeEndpointHandler(tx: Transaction, input: RemoveEndpointHandler): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('endpoint_handler', input.id) ?? tx.refuse('missing', `there is no endpoint handler ${input.id}`);
  endpoint.handler = null;
  endpoints.save(endpoint);
}
