// Generated from data/ by `npm run generate`. Do not edit.

export const GET_ENTRY_POINT_IDENTITY = {
  id: 'LA-AUT-QRY120',
  slice: { aggregate: 'LA-AUT-A20', name: 'entry-point' },
  name: 'get-entry-point',
  description: 'Reads an entry point whole, by its ID: its row, the packages it uses and the standard rules it meets.',
  method: 'GET',
  route: '/api/entry-point/get-entry-point',
} as const;

export const LIST_ENTRY_POINTS_IDENTITY = {
  id: 'LA-AUT-QRY121',
  slice: { aggregate: 'LA-AUT-A20', name: 'entry-point' },
  name: 'list-entry-points',
  description: 'Lists the entry points of a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/entry-point/list-entry-points',
} as const;

export const NEXT_ENTRY_POINT_ID_IDENTITY = {
  id: 'LA-AUT-QRY122',
  slice: { aggregate: 'LA-AUT-A20', name: 'entry-point' },
  name: 'next-id',
  description: 'The next free ID for an entry point of a domain: one past the highest in use.',
  method: 'GET',
  route: '/api/entry-point/next-id',
} as const;
