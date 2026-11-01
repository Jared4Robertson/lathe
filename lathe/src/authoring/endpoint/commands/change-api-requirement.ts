import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ApiRequirementRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { EndpointRepository } from '../repository.ts';
import { CHANGE_API_REQUIREMENT_IDENTITY } from './identities.generated.ts';

/** The API requirement's changes: a column given is set, null clears an optional one. */
export type ChangeApiRequirement = Pick<ApiRequirementRow, 'id'> & { title?: ApiRequirementRow['title']; statement?: ApiRequirementRow['statement']; group_name?: ApiRequirementRow['group_name'] | null };

export const CHANGE_API_REQUIREMENT = {
  ...CHANGE_API_REQUIREMENT_IDENTITY,
  input: {
    id: column('api_requirement', 'id', 'required'),
    title: column('api_requirement', 'title', 'optional'),
    statement: column('api_requirement', 'statement', 'optional'),
    group_name: column('api_requirement', 'group_name', 'clearable'),
  },
  handler: changeApiRequirement,
} satisfies CommandDefinition<ChangeApiRequirement>;

/** Changes the API requirement's columns. */
export function changeApiRequirement(tx: Transaction, input: ChangeApiRequirement): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('api_requirement', input.id) ?? tx.refuse('missing', `there is no API requirement ${input.id}`);
  endpoint.requirements = endpoint.requirements.map((x) => (x.id === input.id ? changed(x, input, ['title', 'statement', 'group_name']) : x));
  endpoints.save(endpoint);
}
