import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ENDPOINT_SLICE } from '../model.ts';
import { EndpointRepository } from '../repository.ts';

/** The endpoint test to remove. */
export type RemoveEndpointTest = { id: string };

export const REMOVE_ENDPOINT_TEST: CommandDefinition<RemoveEndpointTest> = {
  id: 'LA-AUT-CMD332',
  slice: ENDPOINT_SLICE,
  name: 'remove-endpoint-test',
  description: 'Removes an endpoint test with the links it starts. Refused while anything else references them.',
  method: 'POST',
  route: '/api/endpoint/remove-endpoint-test',
  input: {
    id: column('endpoint_test', 'id', 'required'),
  },
  handler: removeEndpointTest,
};

/** Removes the endpoint test from its endpoint. */
export function removeEndpointTest(tx: Transaction, input: RemoveEndpointTest): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('endpoint_test', input.id) ?? tx.refuse('missing', `there is no endpoint test ${input.id}`);
  endpoint.tests = endpoint.tests.filter((x) => x.row.id !== input.id);
  endpoints.save(endpoint);
}
