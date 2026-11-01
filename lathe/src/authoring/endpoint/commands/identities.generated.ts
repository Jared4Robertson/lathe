// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_ENDPOINT_IDENTITY = {
  id: 'LA-AUT-CMD320',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'add-endpoint',
  description: 'Adds an endpoint under the one command or query it exposes (exactly one of command_id and query_id), titled by its method and route.',
  method: 'POST',
  route: '/api/endpoint/add-endpoint',
} as const;

export const CHANGE_ENDPOINT_IDENTITY = {
  id: 'LA-AUT-CMD321',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'change-endpoint',
  description: 'Changes an endpoint\'s title, method, route, description or notes. The command or query it exposes changes only by Move an endpoint.',
  method: 'POST',
  route: '/api/endpoint/change-endpoint',
} as const;

export const MOVE_ENDPOINT_IDENTITY = {
  id: 'LA-AUT-CMD322',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'move-endpoint',
  description: 'Moves an endpoint, with everything in it, to the command or query of its domain it now exposes: give exactly one of command_id and query_id.',
  method: 'POST',
  route: '/api/endpoint/move-endpoint',
} as const;

export const REMOVE_ENDPOINT_IDENTITY = {
  id: 'LA-AUT-CMD323',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'remove-endpoint',
  description: 'Removes an endpoint whole: its API requirements, its handler, its endpoint tests and the links they start. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/endpoint/remove-endpoint',
} as const;

export const ADD_API_REQUIREMENT_IDENTITY = {
  id: 'LA-AUT-CMD324',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'add-api-requirement',
  description: 'Adds an API requirement under its endpoint: one rule the endpoint must follow.',
  method: 'POST',
  route: '/api/endpoint/add-api-requirement',
} as const;

export const CHANGE_API_REQUIREMENT_IDENTITY = {
  id: 'LA-AUT-CMD325',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'change-api-requirement',
  description: 'Changes an API requirement\'s title, statement or group. Its endpoint does not change.',
  method: 'POST',
  route: '/api/endpoint/change-api-requirement',
} as const;

export const REMOVE_API_REQUIREMENT_IDENTITY = {
  id: 'LA-AUT-CMD326',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'remove-api-requirement',
  description: 'Removes an API requirement with its endpoint tests and the links they start. Refused while anything else references them.',
  method: 'POST',
  route: '/api/endpoint/remove-api-requirement',
} as const;

export const ADD_ENDPOINT_HANDLER_IDENTITY = {
  id: 'LA-AUT-CMD327',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'add-endpoint-handler',
  description: 'Adds an endpoint\'s handler, its one piece of code that serves it: its name in code and its file, with the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/endpoint/add-endpoint-handler',
} as const;

export const CHANGE_ENDPOINT_HANDLER_IDENTITY = {
  id: 'LA-AUT-CMD328',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'change-endpoint-handler',
  description: 'Changes an endpoint handler\'s title, file or description, or the standard rules it meets or the packages it uses (each list whole). Its endpoint does not change.',
  method: 'POST',
  route: '/api/endpoint/change-endpoint-handler',
} as const;

export const REMOVE_ENDPOINT_HANDLER_IDENTITY = {
  id: 'LA-AUT-CMD329',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'remove-endpoint-handler',
  description: 'Removes an endpoint handler with the links it starts and the packages it uses. Refused while anything else references them.',
  method: 'POST',
  route: '/api/endpoint/remove-endpoint-handler',
} as const;

export const ADD_ENDPOINT_TEST_IDENTITY = {
  id: 'LA-AUT-CMD330',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'add-endpoint-test',
  description: 'Adds an endpoint test under its API requirement, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/endpoint/add-endpoint-test',
} as const;

export const CHANGE_ENDPOINT_TEST_IDENTITY = {
  id: 'LA-AUT-CMD331',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'change-endpoint-test',
  description: 'Changes an endpoint test\'s columns or the test data sets it starts from (the whole list). Its requirement does not change.',
  method: 'POST',
  route: '/api/endpoint/change-endpoint-test',
} as const;

export const REMOVE_ENDPOINT_TEST_IDENTITY = {
  id: 'LA-AUT-CMD332',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'remove-endpoint-test',
  description: 'Removes an endpoint test with the links it starts. Refused while anything else references them.',
  method: 'POST',
  route: '/api/endpoint/remove-endpoint-test',
} as const;
