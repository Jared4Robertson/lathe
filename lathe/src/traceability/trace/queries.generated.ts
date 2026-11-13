// Generated from data/ by `npm run generate`. Do not edit.

export const LIST_TRACED_USE_CASES_IDENTITY = {
  id: 'LA-TRC-QRY18',
  slice: { aggregate: 'LA-TRC-RM13', name: 'trace' },
  name: 'list-traced-use-cases',
  description: 'Lists each use case of a product\'s space once, from the business outcomes its aggregate or read model serves to its acceptance tests: its UC requirements with their gaps and tests, the aggregates and read models its steps change and read, its flow with each step\'s design (what it fulfills, the interface it is a variant of, its integrations) and each offering interface\'s version of it, derived, and its technical chain, its flow tests, the lower obligations its tests rest on, and its status per stage. Runs the checks first.',
  method: 'GET',
  route: '/api/trace/list-traced-use-cases',
} as const;

export const GET_JOURNEY_PROOF_IDENTITY = {
  id: 'LA-TRC-QRY19',
  slice: { aggregate: 'LA-TRC-RM13', name: 'trace' },
  name: 'get-journey-proof',
  description: 'Gets how far a journey is proved, by its ID, worked out from the records and the checks\' run on every read, never stored: the outcomes it serves, its steps path by path, each with what it carries out, who acts and whether it is proved (a use case when its UC requirements and flow test are, a handoff when its policy\'s test is), its journey test and whether it counts, and the counts of its steps, those carrying out nothing yet and those proved.',
  method: 'GET',
  route: '/api/trace/get-journey-proof',
} as const;

export const LIST_JOURNEY_PROOFS_IDENTITY = {
  id: 'LA-TRC-QRY21',
  slice: { aggregate: 'LA-TRC-RM13', name: 'trace' },
  name: 'list-journey-proofs',
  description: 'Lists how far each journey of a product is proved, in ID order, in one read, each as get-journey-proof answers it: what a page that shows every journey reads, in place of one request per journey.',
  method: 'GET',
  route: '/api/trace/list-journey-proofs',
} as const;
