// Remove an API requirement (LA-AUT-CMD326): Removes an API requirement with its endpoint tests and the links they start. Refused while anything else references them.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ENDPOINT_SLICE } from '../model.ts';
import { EndpointRepository } from '../repository.ts';

/** The API requirement to remove. */
export type RemoveApiRequirement = { id: string };

/** Remove an API requirement (LA-AUT-CMD326). */
export const REMOVE_API_REQUIREMENT: CommandDefinition<RemoveApiRequirement> = {
  id: 'LA-AUT-CMD326',
  slice: ENDPOINT_SLICE,
  name: 'remove-api-requirement',
  description: 'Removes an API requirement with its endpoint tests and the links they start. Refused while anything else references them.',
  method: 'POST',
  route: '/api/endpoint/remove-api-requirement',
  input: {
    id: column('api_requirement', 'id', 'required'),
  },
  handler: removeApiRequirement,
};

/** Removes the API requirement from its endpoint. */
export function removeApiRequirement(tx: Transaction, input: RemoveApiRequirement): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('api_requirement', input.id) ?? tx.refuse('missing', `there is no API requirement ${input.id}`);
  endpoint.requirements = endpoint.requirements.filter((x) => x.id !== input.id);
  endpoint.tests = endpoint.tests.filter((t) => t.row.api_requirement_id !== input.id);
  endpoints.save(endpoint);
}
