// Generated from data/ by `npm run generate`. Do not edit.

export const GET_GUARANTEE_IDENTITY = {
  id: 'LA-MOD-QRY228',
  slice: { aggregate: 'LA-MOD-A24', name: 'guarantee' },
  name: 'get-guarantee',
  description: 'Reads a guarantee whole as its readers read it, by its ID or the ID of one of its tests: the record asked for and its kind, the guarantee\'s own details, the building blocks that keep it, and its guarantee tests with the test data sets they start from.',
  method: 'GET',
  route: '/api/guarantee/get-guarantee',
} as const;

export const LIST_GUARANTEES_IDENTITY = {
  id: 'LA-MOD-QRY229',
  slice: { aggregate: 'LA-MOD-A24', name: 'guarantee' },
  name: 'list-guarantees',
  description: 'Lists the guarantees of a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/guarantee/list-guarantees',
} as const;

export const NEXT_GUARANTEE_ID_IDENTITY = {
  id: 'LA-MOD-QRY230',
  slice: { aggregate: 'LA-MOD-A24', name: 'guarantee' },
  name: 'next-id',
  description: 'The next free ID for a guarantee (under its domain) or a guarantee test (under its guarantee): one past the highest in use.',
  method: 'GET',
  route: '/api/guarantee/next-id',
} as const;
