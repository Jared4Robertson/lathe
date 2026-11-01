// Generated from data/ by `npm run generate`. Do not edit.

export const LIST_TRACED_USE_CASES_IDENTITY = {
  id: 'LA-TRC-QRY18',
  slice: { aggregate: 'LA-TRC-RM13', name: 'trace' },
  name: 'list-traced-use-cases',
  description: 'Lists each use case of a product\'s space once, from the business outcomes its capability serves to its acceptance tests: its UC requirements with their gaps and tests, the aggregates and read models its steps change and read, its flow with each step\'s design (what it fulfills, the interface it is a variant of, its integrations) and each offering interface\'s version of it, derived, and its technical chain, its flow tests, the lower obligations its tests rest on, and its status per stage. Runs the checks first.',
  method: 'GET',
  route: '/api/trace/list-traced-use-cases',
} as const;
