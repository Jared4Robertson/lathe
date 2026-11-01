// Generated from data/ by `npm run generate`. Do not edit.

export const GET_RECORD_TRACE_IDENTITY = {
  id: 'LA-TRC-QRY05',
  slice: { aggregate: 'LA-TRC-RM06', name: 'record-trace' },
  name: 'get-record-trace',
  description: 'Gets one record\'s traceability: for an obligation its chain (designed by, built by with each built or not, proved by) and how each owing domain stands on it with its gaps; for a use case its UC requirements, each judged; for a test what it proves and how it is run; and its other links both ways by relation. Runs the checks first.',
  method: 'GET',
  route: '/api/record-trace/get-record-trace',
} as const;
