// Generated from data/ by `npm run generate`. Do not edit.

export const GET_READ_MODEL_IDENTITY = {
  id: 'LA-MOD-QRY179',
  slice: { aggregate: 'LA-MOD-A10', name: 'read-model' },
  name: 'get-read-model',
  description: 'Reads a read model whole as its readers read it, by its ID or the ID of any record in it: the record asked for and its kind, the read model itself and its fields in order, what it reads, calls and is fed by, its queries by ID each with what it selects by and calls and its handler, its projection and its reader (each piece of code with the standard rules it meets and the packages it uses).',
  method: 'GET',
  route: '/api/read-model/get-read-model',
} as const;

export const LIST_READ_MODELS_IDENTITY = {
  id: 'LA-MOD-QRY180',
  slice: { aggregate: 'LA-MOD-A10', name: 'read-model' },
  name: 'list-read-models',
  description: 'Lists the read models of a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/read-model/list-read-models',
} as const;

export const NEXT_READ_MODEL_ID_IDENTITY = {
  id: 'LA-MOD-QRY181',
  slice: { aggregate: 'LA-MOD-A10', name: 'read-model' },
  name: 'next-id',
  description: 'The next free ID for a read model (under its domain) or a query (under its read model): one past the highest in use; or the one ID of a projection or a reader (under its read model) or a query handler (under its query).',
  method: 'GET',
  route: '/api/read-model/next-id',
} as const;
