import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { EndpointRepository } from '../repository.ts';
import { REMOVE_ENDPOINT_HANDLER_IDENTITY } from './identities.generated.ts';

/** The endpoint handler to remove. */
export type RemoveEndpointHandler = { id: string };

export const REMOVE_ENDPOINT_HANDLER: CommandDefinition<RemoveEndpointHandler> = {
  ...REMOVE_ENDPOINT_HANDLER_IDENTITY,
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
