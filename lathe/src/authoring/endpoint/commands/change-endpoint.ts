import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EndpointRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { EndpointRepository } from '../repository.ts';
import { CHANGE_ENDPOINT_IDENTITY } from './identities.generated.ts';

/** The endpoint's changes: a column given is set, null clears an optional one. */
export type ChangeEndpoint = Pick<EndpointRow, 'id'> & { title?: EndpointRow['title']; method?: EndpointRow['method']; route?: EndpointRow['route']; description?: EndpointRow['description']; notes?: EndpointRow['notes'] | null };

export const CHANGE_ENDPOINT: CommandDefinition<ChangeEndpoint> = {
  ...CHANGE_ENDPOINT_IDENTITY,
  input: {
    id: column('endpoint', 'id', 'required'),
    title: column('endpoint', 'title', 'optional'),
    method: column('endpoint', 'method', 'optional'),
    route: column('endpoint', 'route', 'optional'),
    description: column('endpoint', 'description', 'optional'),
    notes: column('endpoint', 'notes', 'clearable'),
  },
  handler: changeEndpoint,
};

/** Changes the endpoint's columns. */
export function changeEndpoint(tx: Transaction, input: ChangeEndpoint): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.load(input.id) ?? tx.refuse('missing', `there is no endpoint ${input.id}`);
  endpoint.endpoint = changed(endpoint.endpoint, input, ['title', 'method', 'route', 'description', 'notes']);
  endpoints.save(endpoint);
}
