import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ENDPOINT_SLICE } from '../model.ts';
import { EndpointRepository } from '../repository.ts';

/** The endpoint to remove. */
export type RemoveEndpoint = { id: string };

export const REMOVE_ENDPOINT: CommandDefinition<RemoveEndpoint> = {
  id: 'LA-AUT-CMD323',
  slice: ENDPOINT_SLICE,
  name: 'remove-endpoint',
  description: 'Removes an endpoint whole: its API requirements, its handler, its endpoint tests and the links they start. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/endpoint/remove-endpoint',
  input: {
    id: column('endpoint', 'id', 'required'),
  },
  handler: removeEndpoint,
};

/** Removes the endpoint whole. */
export function removeEndpoint(tx: Transaction, input: RemoveEndpoint): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.load(input.id) ?? tx.refuse('missing', `there is no endpoint ${input.id}`);
  endpoints.remove(endpoint);
}
