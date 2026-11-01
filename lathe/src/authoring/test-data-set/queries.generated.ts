// Generated from data/ by `npm run generate`. Do not edit.

export const GET_TEST_DATA_SET_IDENTITY = {
  id: 'LA-AUT-QRY135',
  slice: { aggregate: 'LA-AUT-A17', name: 'test-data-set' },
  name: 'get-test-data-set',
  description: 'Reads a test data set whole as its page shows it, by its ID: its environment, accounts and records, how to prepare and reset it, the file that builds it, and the tests that start from it.',
  method: 'GET',
  route: '/api/test-data-set/get-test-data-set',
} as const;

export const LIST_TEST_DATA_SETS_IDENTITY = {
  id: 'LA-AUT-QRY136',
  slice: { aggregate: 'LA-AUT-A17', name: 'test-data-set' },
  name: 'list-test-data-sets',
  description: 'Lists the test data sets of a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/test-data-set/list-test-data-sets',
} as const;

export const NEXT_TEST_DATA_SET_ID_IDENTITY = {
  id: 'LA-AUT-QRY137',
  slice: { aggregate: 'LA-AUT-A17', name: 'test-data-set' },
  name: 'next-id',
  description: 'The next free ID for a test data set of a domain: one past the highest in use.',
  method: 'GET',
  route: '/api/test-data-set/next-id',
} as const;
