// Generated from data/ by `npm run generate`. Do not edit.

export const LIST_TRACE_ROWS_IDENTITY = {
  id: 'LA-TRC-QRY18',
  slice: { aggregate: 'LA-TRC-RM13', name: 'trace' },
  name: 'list-trace-rows',
  description: 'Lists each use case of a product\'s space once, from the business outcomes its capability serves to its acceptance tests: its UC requirements with their gaps and tests, the aggregates and read models its steps change and read, its flows with each step\'s design (what it fulfills, its view and view requirements, its operations and API requirements, its integrations) and technical chain (interface parts, operations or channels, the records that handle them, what reads and writes the data, where it is stored, and the connectors to integrations), its flow tests, the lower obligations its tests rest on, and its status per stage. Runs the checks first.',
  method: 'GET',
  route: '/api/trace/list-trace-rows',
} as const;
