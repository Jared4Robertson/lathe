// Generated from data/ by `npm run generate`. Do not edit.

export const GET_EXTENSION_RECORD_IDENTITY = {
  id: 'LA-PRD-QRY118',
  slice: { aggregate: 'LA-PRD-A19', name: 'extension-record' },
  name: 'get-extension-record',
  description: 'Reads a record of a product\'s own kind whole: its kind, its own details, the links it starts by relation, and the packages it uses.',
  method: 'GET',
  route: '/api/extension-record/get-extension-record',
} as const;

export const LIST_EXTENSION_RECORDS_IDENTITY = {
  id: 'LA-PRD-QRY119',
  slice: { aggregate: 'LA-PRD-A19', name: 'extension-record' },
  name: 'list-extension-records',
  description: 'Lists the records of a product kind under one parent, by ID, with their titles.',
  method: 'GET',
  route: '/api/extension-record/list-extension-records',
} as const;

export const NEXT_EXTENSION_RECORD_ID_IDENTITY = {
  id: 'LA-PRD-QRY126',
  slice: { aggregate: 'LA-PRD-A19', name: 'extension-record' },
  name: 'next-id',
  description: 'The next free ID for a record of a product kind under its parent, by the kind\'s declared ID pattern: one past the highest in use.',
  method: 'GET',
  route: '/api/extension-record/next-id',
} as const;
