// Generated from data/ by `npm run generate`. Do not edit.

export const GET_TABLE_IDENTITY = {
  id: 'LA-AUT-QRY185',
  slice: { aggregate: 'LA-AUT-A18', name: 'table' },
  name: 'get-table',
  description: 'Reads a table whole as its page shows it, by its ID: its row, the entity, read model or domain it sits under, its keys in order, the standard rules it meets and the packages it uses.',
  method: 'GET',
  route: '/api/table/get-table',
} as const;

export const LIST_TABLES_IDENTITY = {
  id: 'LA-AUT-QRY186',
  slice: { aggregate: 'LA-AUT-A18', name: 'table' },
  name: 'list-tables',
  description: 'Lists the tables under an entity, a read model or a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/table/list-tables',
} as const;

export const NEXT_TABLE_ID_IDENTITY = {
  id: 'LA-AUT-QRY187',
  slice: { aggregate: 'LA-AUT-A18', name: 'table' },
  name: 'next-id',
  description: 'The next free ID for a table: the one ID of an entity\'s or read model\'s table, or a domain\'s next own table, one past the highest in use.',
  method: 'GET',
  route: '/api/table/next-id',
} as const;
