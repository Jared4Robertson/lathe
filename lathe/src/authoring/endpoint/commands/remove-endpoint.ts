import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { EndpointRepository } from '../repository.ts';
import { REMOVE_ENDPOINT_IDENTITY } from './identities.generated.ts';

/** The endpoint to remove. */
export type RemoveEndpoint = { id: string };

export const REMOVE_ENDPOINT: CommandDefinition<RemoveEndpoint> = {
  ...REMOVE_ENDPOINT_IDENTITY,
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
