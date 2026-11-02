// Generated from data/ by `npm run generate`. Do not edit.

export const GET_STORAGE_REQUIREMENT_IDENTITY = {
  id: 'LA-MOD-QRY220',
  slice: { aggregate: 'LA-MOD-A22', name: 'storage-requirement' },
  name: 'get-storage-requirement',
  description: 'Reads a storage requirement whole as its readers read it, by its ID or the ID of one of its storage requirement tests: the record asked for and its kind, the requirement\'s own details, the aggregate or read model it is about, the repository or reader that builds it with the data store that names, and its storage requirement tests with the test data sets each starts from.',
  method: 'GET',
  route: '/api/storage-requirement/get-storage-requirement',
} as const;

export const LIST_STORAGE_REQUIREMENTS_IDENTITY = {
  id: 'LA-MOD-QRY221',
  slice: { aggregate: 'LA-MOD-A22', name: 'storage-requirement' },
  name: 'list-storage-requirements',
  description: 'Lists the storage requirements of an aggregate or read model, by ID, with their titles.',
  method: 'GET',
  route: '/api/storage-requirement/list-storage-requirements',
} as const;

export const NEXT_STORAGE_REQUIREMENT_ID_IDENTITY = {
  id: 'LA-MOD-QRY222',
  slice: { aggregate: 'LA-MOD-A22', name: 'storage-requirement' },
  name: 'next-id',
  description: 'The next free ID for a storage requirement (under its aggregate or read model) or a storage requirement test (under its storage requirement): one past the highest in use.',
  method: 'GET',
  route: '/api/storage-requirement/next-id',
} as const;
