// Generated from data/ by `npm run generate`. Do not edit.

export const GET_USE_CASE_IDENTITY = {
  id: 'LA-AUT-QRY100',
  slice: { aggregate: 'LA-AUT-A11', name: 'use-case' },
  name: 'get-use-case',
  description: 'Reads a use case whole as its page shows it, by its ID or the ID of any record in it: the record asked for and its kind, the use case\'s row and actors, its UC requirements each with its tests and the steps that fulfill it, and its flows by interface, each with its steps path by path in order (with the links each starts) and its flow test.',
  method: 'GET',
  route: '/api/use-case/get-use-case',
} as const;

export const LIST_USE_CASES_IDENTITY = {
  id: 'LA-AUT-QRY101',
  slice: { aggregate: 'LA-AUT-A11', name: 'use-case' },
  name: 'list-use-cases',
  description: 'Lists the use cases of a capability, by ID, with their titles.',
  method: 'GET',
  route: '/api/use-case/list-use-cases',
} as const;

export const NEXT_USE_CASE_ID_IDENTITY = {
  id: 'LA-AUT-QRY102',
  slice: { aggregate: 'LA-AUT-A11', name: 'use-case' },
  name: 'next-id',
  description: 'The next free ID for a use case (under a capability), UC requirement or flow (under a use case), use case test (under a requirement), or flow step or flow test (under a flow): one past the highest in use, a flow\'s ending in the number of the first interface it has no flow through yet.',
  method: 'GET',
  route: '/api/use-case/next-id',
} as const;
