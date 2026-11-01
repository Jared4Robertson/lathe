// Generated from data/ by `npm run generate`. Do not edit.

export const GET_COVERAGE_IDENTITY = {
  id: 'LA-TRC-QRY01',
  slice: { aggregate: 'LA-TRC-RM01', name: 'coverage' },
  name: 'get-coverage',
  description: 'Gets a product\'s coverage, for its records outside every domain and then each domain: per obligation kind how many are designed, built, proved and not automated yet out of the total, its tests by state, and its gaps. Runs the checks first.',
  method: 'GET',
  route: '/api/coverage/get-coverage',
} as const;
