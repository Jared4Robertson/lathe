// Generated from data/ by `npm run generate`. Do not edit.

export const GET_DATA_STORE_IDENTITY = {
  id: 'LA-AUT-QRY225',
  slice: { aggregate: 'LA-AUT-A23', name: 'data-store' },
  name: 'get-data-store',
  description: 'Reads a data store whole as its readers read it: its own details, the product or domain it sits under, the integration that reaches it, and the repositories, readers and tables stored in it.',
  method: 'GET',
  route: '/api/data-store/get-data-store',
} as const;

export const LIST_DATA_STORES_IDENTITY = {
  id: 'LA-AUT-QRY226',
  slice: { aggregate: 'LA-AUT-A23', name: 'data-store' },
  name: 'list-data-stores',
  description: 'Lists the data stores of a product (its own and its domains\') or of a domain, by ID, with their titles and kinds.',
  method: 'GET',
  route: '/api/data-store/list-data-stores',
} as const;

export const NEXT_DATA_STORE_ID_IDENTITY = {
  id: 'LA-AUT-QRY227',
  slice: { aggregate: 'LA-AUT-A23', name: 'data-store' },
  name: 'next-id',
  description: 'The next free ID for a data store under its product or domain: one past the highest in use.',
  method: 'GET',
  route: '/api/data-store/next-id',
} as const;
