import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { EndpointRepository } from '../repository.ts';
import { REMOVE_ENDPOINT_TEST_IDENTITY } from './identities.generated.ts';

/** The endpoint test to remove. */
export type RemoveEndpointTest = { id: string };

export const REMOVE_ENDPOINT_TEST: CommandDefinition<RemoveEndpointTest> = {
  ...REMOVE_ENDPOINT_TEST_IDENTITY,
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
