// Generated from data/ by `npm run generate`. Do not edit.

export const GET_PATTERN_IDENTITY = {
  id: 'LA-AUT-QRY138',
  slice: { aggregate: 'LA-AUT-A2', name: 'pattern' },
  name: 'get-pattern',
  description: 'Reads a pattern whole as its page shows it, by its ID or the ID of any rule or rule test in it: the record asked for and its kind, the pattern\'s row, its settings in order, and its rules by ID, each with its tests (with the test data sets they start from).',
  method: 'GET',
  route: '/api/pattern/get-pattern',
} as const;

export const LIST_PATTERNS_IDENTITY = {
  id: 'LA-AUT-QRY139',
  slice: { aggregate: 'LA-AUT-A2', name: 'pattern' },
  name: 'list-patterns',
  description: 'Lists the patterns of a product, by ID, with their titles.',
  method: 'GET',
  route: '/api/pattern/list-patterns',
} as const;

export const NEXT_PATTERN_ID_IDENTITY = {
  id: 'LA-AUT-QRY140',
  slice: { aggregate: 'LA-AUT-A2', name: 'pattern' },
  name: 'next-id',
  description: 'The next free ID for a pattern rule (under a pattern) or a pattern rule test (under a rule): one past the highest in use.',
  method: 'GET',
  route: '/api/pattern/next-id',
} as const;
