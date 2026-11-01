// Generated from data/ by `npm run generate`. Do not edit.

export const GET_ENDPOINT_IDENTITY = {
  id: 'LA-AUT-QRY194',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'get-endpoint',
  description: 'Reads an endpoint whole as its readers read it, by its ID or the ID of any record in it: the record asked for and its kind, the endpoint\'s own details, its handler (with the standard rules it meets and the packages it uses), and its API requirements by ID, each with its tests (with the test data sets they start from).',
  method: 'GET',
  route: '/api/endpoint/get-endpoint',
} as const;

export const LIST_ENDPOINTS_IDENTITY = {
  id: 'LA-AUT-QRY195',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'list-endpoints',
  description: 'Lists the endpoints that expose a command or query, by ID, with their titles.',
  method: 'GET',
  route: '/api/endpoint/list-endpoints',
} as const;

export const NEXT_ENDPOINT_ID_IDENTITY = {
  id: 'LA-AUT-QRY196',
  slice: { aggregate: 'LA-AUT-A13', name: 'endpoint' },
  name: 'next-id',
  description: 'The next free ID for an endpoint (under a command or query), an API requirement or endpoint handler (under an endpoint) or an endpoint test (under an API requirement): one past the highest in use.',
  method: 'GET',
  route: '/api/endpoint/next-id',
} as const;
