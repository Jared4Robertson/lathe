// Generated from data/ by `npm run generate`. Do not edit.

export const GET_ERD_IDENTITY = {
  id: 'LA-EXP-QRY10',
  slice: { aggregate: 'LA-EXP-RM04', name: 'erd' },
  name: 'get-erd',
  description: 'Gets a product\'s ERD map: every domain\'s region, each aggregate\'s boundary with its entities (the root first) and their fields and types, and the has-one, has-many and reference-by-ID lines between entities.',
  method: 'GET',
  route: '/api/erd/get-erd',
} as const;
