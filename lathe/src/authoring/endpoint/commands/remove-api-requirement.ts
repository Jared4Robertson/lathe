import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { EndpointRepository } from '../repository.ts';
import { REMOVE_API_REQUIREMENT_IDENTITY } from './identities.generated.ts';

/** The API requirement to remove. */
export type RemoveApiRequirement = { id: string };

export const REMOVE_API_REQUIREMENT: CommandDefinition<RemoveApiRequirement> = {
  ...REMOVE_API_REQUIREMENT_IDENTITY,
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
