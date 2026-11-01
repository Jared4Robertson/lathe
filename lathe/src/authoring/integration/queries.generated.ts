// Generated from data/ by `npm run generate`. Do not edit.

export const GET_INTEGRATION_IDENTITY = {
  id: 'LA-AUT-QRY199',
  slice: { aggregate: 'LA-AUT-A14', name: 'integration' },
  name: 'get-integration',
  description: 'Reads an integration whole as its page shows it, by its ID or the ID of any record in it: the record asked for and its kind, the integration\'s row, its adapter (with the standard rules it meets and the packages it uses), and its integration tests by ID (with the test data sets they start from).',
  method: 'GET',
  route: '/api/integration/get-integration',
} as const;

export const LIST_INTEGRATIONS_IDENTITY = {
  id: 'LA-AUT-QRY200',
  slice: { aggregate: 'LA-AUT-A14', name: 'integration' },
  name: 'list-integrations',
  description: 'Lists the integrations of a product, by ID, with their titles.',
  method: 'GET',
  route: '/api/integration/list-integrations',
} as const;

export const NEXT_INTEGRATION_ID_IDENTITY = {
  id: 'LA-AUT-QRY201',
  slice: { aggregate: 'LA-AUT-A14', name: 'integration' },
  name: 'next-id',
  description: 'The next free ID for an integration (under a product), or an adapter or integration test (under an integration): one past the highest in use.',
  method: 'GET',
  route: '/api/integration/next-id',
} as const;
