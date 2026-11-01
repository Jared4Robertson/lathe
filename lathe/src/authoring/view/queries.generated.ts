// Generated from data/ by `npm run generate`. Do not edit.

export const GET_VIEW_IDENTITY = {
  id: 'LA-AUT-QRY190',
  slice: { aggregate: 'LA-AUT-A12', name: 'view' },
  name: 'get-view',
  description: 'Reads a view whole as its readers read it, by its ID or the ID of any requirement or test in it: the record asked for and its kind, the view\'s own details, and its requirements by ID, each with its tests (with the test data sets they start from).',
  method: 'GET',
  route: '/api/view/get-view',
} as const;

export const LIST_VIEWS_IDENTITY = {
  id: 'LA-AUT-QRY191',
  slice: { aggregate: 'LA-AUT-A12', name: 'view' },
  name: 'list-views',
  description: 'Lists the views of a product, by ID, with their titles.',
  method: 'GET',
  route: '/api/view/list-views',
} as const;

export const NEXT_VIEW_ID_IDENTITY = {
  id: 'LA-AUT-QRY192',
  slice: { aggregate: 'LA-AUT-A12', name: 'view' },
  name: 'next-id',
  description: 'The next free ID for a view (under a product), a view requirement (under a view) or a view test (under a view requirement): one past the highest in use.',
  method: 'GET',
  route: '/api/view/next-id',
} as const;
