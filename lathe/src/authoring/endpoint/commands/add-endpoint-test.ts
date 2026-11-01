import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EndpointTestRow } from '../../../platform/data/tables.ts';
import { EndpointRepository } from '../repository.ts';
import { ADD_ENDPOINT_TEST_IDENTITY } from './identities.generated.ts';

export type AddEndpointTest = Pick<EndpointTestRow, 'id' | 'title' | 'api_requirement_id' | 'level' | 'state' | 'when' | 'then' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'notes'> & { starts_from?: string[] };

export const ADD_ENDPOINT_TEST = {
  ...ADD_ENDPOINT_TEST_IDENTITY,
  input: {
    id: column('endpoint_test', 'id', 'required'),
    title: column('endpoint_test', 'title', 'required'),
    api_requirement_id: column('endpoint_test', 'api_requirement_id', 'required'),
    level: column('endpoint_test', 'level', 'required'),
    state: column('endpoint_test', 'state', 'required'),
    when: column('endpoint_test', 'when', 'required'),
    then: column('endpoint_test', 'then', 'required'),
    file: column('endpoint_test', 'file', 'optional'),
    manual_reason: column('endpoint_test', 'manual_reason', 'optional'),
    size: column('endpoint_test', 'size', 'optional'),
    smoke: column('endpoint_test', 'smoke', 'optional'),
    external: column('endpoint_test', 'external', 'optional'),
    notes: column('endpoint_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addEndpointTest,
} satisfies CommandDefinition<AddEndpointTest>;

export function addEndpointTest(tx: Transaction, input: AddEndpointTest): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('api_requirement', input.api_requirement_id) ?? tx.refuse('missing', `there is no API requirement ${input.api_requirement_id}`);
  const { starts_from = [], ...row } = input;
  endpoint.tests.push({ row, startsFrom: starts_from });
  endpoints.save(endpoint);
}
