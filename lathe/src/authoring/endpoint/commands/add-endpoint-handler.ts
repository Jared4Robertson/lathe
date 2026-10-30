// Add an endpoint handler (LA-AUT-CMD327): Adds an endpoint's handler, its one piece of code that serves it: its name in code and its file, with the standard rules it meets and the packages it uses.
import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EndpointHandlerRow } from '../../../platform/data/tables.ts';
import { ENDPOINT_SLICE } from '../model.ts';
import { EndpointRepository } from '../repository.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import { oneEndpointHandler } from '../rules.ts';

/** A new endpoint handler, with the links it starts. */
export type AddEndpointHandler = Pick<EndpointHandlerRow, 'id' | 'title' | 'endpoint_id' | 'description' | 'file'> & { meets?: string[]; packages?: string[] };

/** Add an endpoint handler (LA-AUT-CMD327). */
export const ADD_ENDPOINT_HANDLER: CommandDefinition<AddEndpointHandler> = {
  id: 'LA-AUT-CMD327',
  slice: ENDPOINT_SLICE,
  name: 'add-endpoint-handler',
  description: "Adds an endpoint's handler, its one piece of code that serves it: its name in code and its file, with the standard rules it meets and the packages it uses.",
  method: 'POST',
  route: '/api/endpoint/add-endpoint-handler',
  input: {
    id: column('endpoint_handler', 'id', 'required'),
    title: column('endpoint_handler', 'title', 'required'),
    endpoint_id: column('endpoint_handler', 'endpoint_id', 'required'),
    description: column('endpoint_handler', 'description', 'required'),
    file: column('endpoint_handler', 'file', 'optional'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts("The packages it uses, each listed in one of the product's package.json files.", 'optional'),
  },
  handler: addEndpointHandler,
};

/** Adds the endpoint handler under its endpoint, with its links. */
export function addEndpointHandler(tx: Transaction, input: AddEndpointHandler): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('endpoint', input.endpoint_id) ?? tx.refuse('missing', `there is no endpoint ${input.endpoint_id}`);
  const { meets = [], packages = [], ...row } = input;
  refuseBroken(oneEndpointHandler([...(endpoint.handler ? [endpoint.handler.row] : []), row]));
  endpoint.handler = { row, meets, packages };
  endpoints.save(endpoint);
}
