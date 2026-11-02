// Generated from data/ by `npm run generate`. Do not edit.

export const GET_JOURNEY_IDENTITY = {
  id: 'LA-PRD-QRY228',
  slice: { aggregate: 'LA-PRD-A25', name: 'journey' },
  name: 'get-journey',
  description: 'Reads a journey whole as its readers read it, by its ID or the ID of any record in it: the record asked for and its kind, the journey\'s own details, the outcomes it serves, its steps path by path with what each carries out (a use case with its actors, capability and domain, or a policy with the event it hears, the command it sends and its domain), and its journey test with the test data sets it starts from.',
  method: 'GET',
  route: '/api/journey/get-journey',
} as const;

export const LIST_JOURNEYS_IDENTITY = {
  id: 'LA-PRD-QRY229',
  slice: { aggregate: 'LA-PRD-A25', name: 'journey' },
  name: 'list-journeys',
  description: 'Lists the journeys of a product, by ID, with their titles.',
  method: 'GET',
  route: '/api/journey/list-journeys',
} as const;

export const NEXT_JOURNEY_ID_IDENTITY = {
  id: 'LA-PRD-QRY230',
  slice: { aggregate: 'LA-PRD-A25', name: 'journey' },
  name: 'next-id',
  description: 'The next free ID for a journey (under a product) or a journey step (under a journey): one past the highest in use; or the one ID of a journey test (under a journey).',
  method: 'GET',
  route: '/api/journey/next-id',
} as const;
