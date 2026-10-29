// Move an endpoint (LA-AUT-CMD322): Moves an endpoint, with everything in it, to the command or query of its domain it now exposes: give exactly one of command_id and query_id.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EndpointRow } from '../../../platform/data/tables.ts';
import { ENDPOINT_SLICE } from '../model.ts';
import { EndpointRepository } from '../repository.ts';

/** The endpoint and the one command or query it moves to. */
export type MoveEndpoint = Pick<EndpointRow, 'id' | 'command_id' | 'query_id'>;

/** Move an endpoint (LA-AUT-CMD322). */
export const MOVE_ENDPOINT: CommandDefinition<MoveEndpoint> = {
  id: 'LA-AUT-CMD322',
  slice: ENDPOINT_SLICE,
  name: 'move-endpoint',
  description: 'Moves an endpoint, with everything in it, to the command or query of its domain it now exposes: give exactly one of command_id and query_id.',
  method: 'POST',
  route: '/api/endpoint/move-endpoint',
  input: {
    id: column('endpoint', 'id', 'required'),
    command_id: column('endpoint', 'command_id', 'optional'),
    query_id: column('endpoint', 'query_id', 'optional'),
  },
  handler: moveEndpoint,
};

/** Puts the endpoint under the command or query it now exposes; what is in it keeps its IDs. */
export function moveEndpoint(tx: Transaction, input: MoveEndpoint): void {
  const endpoints = new EndpointRepository(tx);
  if ((input.command_id === undefined) === (input.query_id === undefined)) tx.refuse('parent', `${input.id} moves to exactly one command or query: give command_id or query_id, not ${input.command_id === undefined ? 'neither' : 'both'}`);
  const endpoint = endpoints.load(input.id) ?? tx.refuse('missing', `there is no endpoint ${input.id}`);
  const target = input.command_id ?? input.query_id!;
  if (endpoint.endpoint.command_id === target || endpoint.endpoint.query_id === target) tx.refuse('parent', `${input.id} already exposes ${target}`);
  const { command_id: _command, query_id: _query, ...rest } = endpoint.endpoint;
  endpoint.endpoint = { ...rest, ...(input.command_id ? { command_id: input.command_id } : { query_id: input.query_id }) };
  endpoints.save(endpoint);
}
