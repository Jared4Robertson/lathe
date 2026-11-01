import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EndpointRow } from '../../../platform/data/tables.ts';
import { EndpointRepository } from '../repository.ts';
import { MOVE_ENDPOINT_IDENTITY } from './identities.generated.ts';

/** The endpoint and the one command or query it moves to. */
export type MoveEndpoint = Pick<EndpointRow, 'id' | 'command_id' | 'query_id'>;

export const MOVE_ENDPOINT: CommandDefinition<MoveEndpoint> = {
  ...MOVE_ENDPOINT_IDENTITY,
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
