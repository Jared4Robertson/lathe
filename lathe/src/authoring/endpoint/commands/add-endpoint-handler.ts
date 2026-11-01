import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EndpointHandlerRow } from '../../../platform/data/tables.ts';
import { EndpointRepository } from '../repository.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import { oneEndpointHandler } from '../rules.ts';
import { ADD_ENDPOINT_HANDLER_IDENTITY } from './identities.generated.ts';

export type AddEndpointHandler = Pick<EndpointHandlerRow, 'id' | 'title' | 'endpoint_id' | 'description' | 'file'> & { meets?: string[]; packages?: string[] };

export const ADD_ENDPOINT_HANDLER: CommandDefinition<AddEndpointHandler> = {
  ...ADD_ENDPOINT_HANDLER_IDENTITY,
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

export function addEndpointHandler(tx: Transaction, input: AddEndpointHandler): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('endpoint', input.endpoint_id) ?? tx.refuse('missing', `there is no endpoint ${input.endpoint_id}`);
  const { meets = [], packages = [], ...row } = input;
  refuseBroken(oneEndpointHandler([...(endpoint.handler ? [endpoint.handler.row] : []), row]));
  endpoint.handler = { row, meets, packages };
  endpoints.save(endpoint);
}
