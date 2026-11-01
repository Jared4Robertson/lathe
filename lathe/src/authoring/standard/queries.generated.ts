// Generated from data/ by `npm run generate`. Do not edit.

export const GET_STANDARD_IDENTITY = {
  id: 'LA-AUT-QRY142',
  slice: { aggregate: 'LA-AUT-A3', name: 'standard' },
  name: 'get-standard',
  description: 'Reads a standard whole as its page shows it, by its ID or the ID of any rule or rule test in it: the record asked for and its kind, the standard\'s row, and its rules by ID, each with the records that meet it and its tests (with the test data sets they start from).',
  method: 'GET',
  route: '/api/standard/get-standard',
} as const;

export const LIST_STANDARDS_IDENTITY = {
  id: 'LA-AUT-QRY143',
  slice: { aggregate: 'LA-AUT-A3', name: 'standard' },
  name: 'list-standards',
  description: 'Lists the standards of a product, by ID, with their titles.',
  method: 'GET',
  route: '/api/standard/list-standards',
} as const;

export const NEXT_STANDARD_ID_IDENTITY = {
  id: 'LA-AUT-QRY144',
  slice: { aggregate: 'LA-AUT-A3', name: 'standard' },
  name: 'next-id',
  description: 'The next free ID for a standard rule (under a standard) or a standard rule test (under a rule): one past the highest in use.',
  method: 'GET',
  route: '/api/standard/next-id',
} as const;
