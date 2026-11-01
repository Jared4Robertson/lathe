// Generated from data/ by `npm run generate`. Do not edit.

export const GET_TEST_COUNTS_IDENTITY = {
  id: 'LA-TRC-QRY03',
  slice: { aggregate: 'LA-TRC-RM03', name: 'tests-by-state' },
  name: 'get-test-counts',
  description: 'Returns one entry per domain of a product, and one for what lies outside every domain, with its tests counted as automated, manual and not automated yet, the product\'s own scope first, then by domain. Runs the checks first.',
  method: 'GET',
  route: '/api/tests-by-state/get-test-counts',
} as const;
