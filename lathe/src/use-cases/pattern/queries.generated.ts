// Generated from data/ by `npm run generate`. Do not edit.

export const GET_PATTERN_IDENTITY = {
  id: 'LA-UCS-QRY138',
  slice: { aggregate: 'LA-UCS-A2', name: 'pattern' },
  name: 'get-pattern',
  description: 'Reads a pattern whole as its readers read it, by its ID or the ID of any rule, rule test or slot in it: the record asked for and its kind, the pattern\'s own details, its settings in order, its rules by ID, each with its tests (with the test data sets they start from), and its slots by ID.',
  method: 'GET',
  route: '/api/pattern/get-pattern',
} as const;

export const LIST_PATTERNS_IDENTITY = {
  id: 'LA-UCS-QRY139',
  slice: { aggregate: 'LA-UCS-A2', name: 'pattern' },
  name: 'list-patterns',
  description: 'Lists the patterns of a product, by ID, with their titles.',
  method: 'GET',
  route: '/api/pattern/list-patterns',
} as const;

export const NEXT_PATTERN_ID_IDENTITY = {
  id: 'LA-UCS-QRY140',
  slice: { aggregate: 'LA-UCS-A2', name: 'pattern' },
  name: 'next-id',
  description: 'The next free ID for a pattern rule or a slot (under a pattern) or a pattern rule test (under a rule): one past the highest in use.',
  method: 'GET',
  route: '/api/pattern/next-id',
} as const;
