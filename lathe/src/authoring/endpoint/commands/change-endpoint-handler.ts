// Change an endpoint handler (LA-AUT-CMD328): Changes an endpoint handler's title, file or description, or the standard rules it meets or the packages it uses (each list whole). Its endpoint does not change.
import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EndpointHandlerRow } from '../../../platform/data/tables.ts';
import { changed, ENDPOINT_SLICE } from '../model.ts';
import { EndpointRepository } from '../repository.ts';

/** The endpoint handler's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeEndpointHandler = Pick<EndpointHandlerRow, 'id'> & { title?: EndpointHandlerRow['title']; description?: EndpointHandlerRow['description']; file?: EndpointHandlerRow['file'] | null; meets?: string[]; packages?: string[] };

/** Change an endpoint handler (LA-AUT-CMD328). */
export const CHANGE_ENDPOINT_HANDLER: CommandDefinition<ChangeEndpointHandler> = {
  id: 'LA-AUT-CMD328',
  slice: ENDPOINT_SLICE,
  name: 'change-endpoint-handler',
  description: "Changes an endpoint handler's title, file or description, or the standard rules it meets or the packages it uses (each list whole). Its endpoint does not change.",
  method: 'POST',
  route: '/api/endpoint/change-endpoint-handler',
  input: {
    id: column('endpoint_handler', 'id', 'required'),
    title: column('endpoint_handler', 'title', 'optional'),
    description: column('endpoint_handler', 'description', 'optional'),
    file: column('endpoint_handler', 'file', 'clearable'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
  },
  handler: changeEndpointHandler,
};

/** Changes the endpoint handler's columns and links. */
export function changeEndpointHandler(tx: Transaction, input: ChangeEndpointHandler): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('endpoint_handler', input.id) ?? tx.refuse('missing', `there is no endpoint handler ${input.id}`);
  const current = endpoint.handler!;
  endpoint.handler = { row: changed(current.row, input, ['title', 'description', 'file']), meets: input.meets ?? current.meets, packages: input.packages ?? current.packages };
  endpoints.save(endpoint);
}
