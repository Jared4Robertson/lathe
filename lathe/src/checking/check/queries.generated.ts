// Generated from data/ by `npm run generate`. Do not edit.

export const GET_CHECK_IDENTITY = {
  id: 'LA-CHK-QRY10',
  slice: { aggregate: 'LA-CHK-A1', name: 'check' },
  name: 'get-check',
  description: 'Reads a check row whole, by its name: its product, place in the run order, severity, summary, explanation, query and kinds.',
  method: 'GET',
  route: '/api/check/get-check',
} as const;

export const LIST_CHECKS_IDENTITY = {
  id: 'LA-CHK-QRY11',
  slice: { aggregate: 'LA-CHK-A1', name: 'check' },
  name: 'list-checks',
  description: 'Lists the checks that run on a product, Lathe\'s first and then the product\'s own, each in its run order, with its severity and summary.',
  method: 'GET',
  route: '/api/check/list-checks',
} as const;
