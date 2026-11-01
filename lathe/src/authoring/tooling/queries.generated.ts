// Generated from data/ by `npm run generate`. Do not edit.

export const GET_TOOLING_IDENTITY = {
  id: 'LA-AUT-QRY123',
  slice: { aggregate: 'LA-AUT-A21', name: 'tooling' },
  name: 'get-tooling',
  description: 'Reads a tooling record whole, by its ID: its own details, the packages it uses and the standard rules it meets.',
  method: 'GET',
  route: '/api/tooling/get-tooling',
} as const;

export const LIST_TOOLING_IDENTITY = {
  id: 'LA-AUT-QRY124',
  slice: { aggregate: 'LA-AUT-A21', name: 'tooling' },
  name: 'list-tooling',
  description: 'Lists the tooling records of a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/tooling/list-tooling',
} as const;

export const NEXT_TOOLING_ID_IDENTITY = {
  id: 'LA-AUT-QRY125',
  slice: { aggregate: 'LA-AUT-A21', name: 'tooling' },
  name: 'next-id',
  description: 'The next free ID for a tooling record of a domain: one past the highest in use.',
  method: 'GET',
  route: '/api/tooling/next-id',
} as const;
