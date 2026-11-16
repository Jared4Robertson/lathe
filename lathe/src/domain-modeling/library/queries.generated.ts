// Generated from data/ by `npm run generate`. Do not edit.

export const GET_LIBRARY_IDENTITY = {
  id: 'LA-MOD-QRY234',
  slice: { aggregate: 'LA-MOD-A26', name: 'library' },
  name: 'get-library',
  description: 'Reads a library by its ID as its readers read it: its own details, the business outcomes it serves and the guarantees it makes.',
  method: 'GET',
  route: '/api/library/get-library',
} as const;

export const LIST_LIBRARIES_IDENTITY = {
  id: 'LA-MOD-QRY235',
  slice: { aggregate: 'LA-MOD-A26', name: 'library' },
  name: 'list-libraries',
  description: 'Lists the libraries of a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/library/list-libraries',
} as const;

export const NEXT_LIBRARY_ID_IDENTITY = {
  id: 'LA-MOD-QRY236',
  slice: { aggregate: 'LA-MOD-A26', name: 'library' },
  name: 'next-id',
  description: 'The next free ID for a library of a domain: one past the highest in use.',
  method: 'GET',
  route: '/api/library/next-id',
} as const;
