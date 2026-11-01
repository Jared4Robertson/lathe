import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ApiRequirementRow } from '../../../platform/data/tables.ts';
import { EndpointRepository } from '../repository.ts';
import { ADD_API_REQUIREMENT_IDENTITY } from './identities.generated.ts';

/** A new API requirement. */
export type AddApiRequirement = Pick<ApiRequirementRow, 'id' | 'title' | 'endpoint_id' | 'statement' | 'group_name'>;

export const ADD_API_REQUIREMENT: CommandDefinition<AddApiRequirement> = {
  ...ADD_API_REQUIREMENT_IDENTITY,
  input: {
    id: column('api_requirement', 'id', 'required'),
    title: column('api_requirement', 'title', 'required'),
    endpoint_id: column('api_requirement', 'endpoint_id', 'required'),
    statement: column('api_requirement', 'statement', 'required'),
    group_name: column('api_requirement', 'group_name', 'optional'),
  },
  handler: addApiRequirement,
};

export function addApiRequirement(tx: Transaction, input: AddApiRequirement): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('endpoint', input.endpoint_id) ?? tx.refuse('missing', `there is no endpoint ${input.endpoint_id}`);
  endpoint.requirements.push(input);
  endpoints.save(endpoint);
}
