// Generated from data/ by `npm run generate`. Do not edit.
// The endpoint commands whose handler is the pattern: load the endpoint, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { EndpointRepository } from '../repository.ts';
import type { AddEndpoint } from './add-endpoint.ts';
import type { ChangeEndpoint } from './change-endpoint.ts';
import type { RemoveEndpoint } from './remove-endpoint.ts';
import type { AddApiRequirement } from './add-api-requirement.ts';
import type { ChangeApiRequirement } from './change-api-requirement.ts';
import type { RemoveApiRequirement } from './remove-api-requirement.ts';
import type { ChangeEndpointHandler } from './change-endpoint-handler.ts';
import type { RemoveEndpointHandler } from './remove-endpoint-handler.ts';
import type { AddEndpointTest } from './add-endpoint-test.ts';
import type { ChangeEndpointTest } from './change-endpoint-test.ts';
import type { RemoveEndpointTest } from './remove-endpoint-test.ts';

/** Adds an endpoint under the one command or query it exposes (exactly one of command_id and query_id), titled by its method and route. */
export function addEndpoint(tx: Transaction, input: AddEndpoint): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.create({ root: input.id, endpoint: input, requirements: [], handler: null, tests: [] });
  endpoints.save(endpoint);
}

/** Changes an endpoint's title, method, route, description or notes. The command or query it exposes changes only by Move an endpoint. */
export function changeEndpoint(tx: Transaction, input: ChangeEndpoint): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.load(input.id) ?? tx.refuse('missing', `there is no endpoint ${input.id}`);
  endpoint.endpoint = changed(endpoint.endpoint, input, ['title', 'method', 'route', 'description', 'notes']);
  endpoints.save(endpoint);
}

/** Removes an endpoint whole: its API requirements, its handler, its endpoint tests and the links they start. Refused while anything outside it references what is in it. */
export function removeEndpoint(tx: Transaction, input: RemoveEndpoint): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.load(input.id) ?? tx.refuse('missing', `there is no endpoint ${input.id}`);
  endpoints.remove(endpoint);
}

/** Adds an API requirement under its endpoint: one rule the endpoint must follow. */
export function addApiRequirement(tx: Transaction, input: AddApiRequirement): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.load(input.endpoint_id) ?? tx.refuse('missing', `there is no endpoint ${input.endpoint_id}`);
  endpoint.requirements.push(input);
  endpoints.save(endpoint);
}

/** Changes an API requirement's title, statement or group. Its endpoint does not change. */
export function changeApiRequirement(tx: Transaction, input: ChangeApiRequirement): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('api_requirement', input.id) ?? tx.refuse('missing', `there is no API requirement ${input.id}`);
  endpoint.requirements = endpoint.requirements.map((x) => (x.id === input.id ? changed(x, input, ['title', 'statement', 'group_name']) : x));
  endpoints.save(endpoint);
}

/** Removes an API requirement with its endpoint tests and the links they start. Refused while anything else references them. */
export function removeApiRequirement(tx: Transaction, input: RemoveApiRequirement): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('api_requirement', input.id) ?? tx.refuse('missing', `there is no API requirement ${input.id}`);
  endpoint.requirements = endpoint.requirements.filter((x) => x.id !== input.id);
  endpoint.tests = endpoint.tests.filter((x) => x.row.api_requirement_id !== input.id);
  endpoints.save(endpoint);
}

/** Changes an endpoint handler's title, file or description, or the standard rules it meets or the packages it uses (each list whole). Its endpoint does not change. */
export function changeEndpointHandler(tx: Transaction, input: ChangeEndpointHandler): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('endpoint_handler', input.id) ?? tx.refuse('missing', `there is no endpoint handler ${input.id}`);
  const held = endpoint.handler!;
  endpoint.handler = { row: changed(held.row, input, ['title', 'description', 'file']), meets: input.meets ?? held.meets, packages: input.packages ?? held.packages };
  endpoints.save(endpoint);
}

/** Removes an endpoint handler with the links it starts and the packages it uses. Refused while anything else references them. */
export function removeEndpointHandler(tx: Transaction, input: RemoveEndpointHandler): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('endpoint_handler', input.id) ?? tx.refuse('missing', `there is no endpoint handler ${input.id}`);
  endpoint.handler = null;
  endpoints.save(endpoint);
}

/** Adds an endpoint test under its API requirement, with the test data sets it starts from. */
export function addEndpointTest(tx: Transaction, input: AddEndpointTest): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('api_requirement', input.api_requirement_id) ?? tx.refuse('missing', `there is no API requirement ${input.api_requirement_id}`);
  const { starts_from = [], ...row } = input;
  endpoint.tests.push({ row, startsFrom: starts_from });
  endpoints.save(endpoint);
}

/** Changes an endpoint test's columns or the test data sets it starts from (the whole list). Its requirement does not change. */
export function changeEndpointTest(tx: Transaction, input: ChangeEndpointTest): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('endpoint_test', input.id) ?? tx.refuse('missing', `there is no endpoint test ${input.id}`);
  endpoint.tests = endpoint.tests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'level', 'state', 'when', 'then', 'file', 'manual_reason', 'size', 'smoke', 'external', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  endpoints.save(endpoint);
}

/** Removes an endpoint test with the links it starts. Refused while anything else references them. */
export function removeEndpointTest(tx: Transaction, input: RemoveEndpointTest): void {
  const endpoints = new EndpointRepository(tx);
  const endpoint = endpoints.loadHolding('endpoint_test', input.id) ?? tx.refuse('missing', `there is no endpoint test ${input.id}`);
  endpoint.tests = endpoint.tests.filter((x) => x.row.id !== input.id);
  endpoints.save(endpoint);
}
