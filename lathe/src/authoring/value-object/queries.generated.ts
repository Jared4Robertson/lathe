// Generated from data/ by `npm run generate`. Do not edit.

export const GET_VALUE_OBJECT_IDENTITY = {
  id: 'LA-AUT-QRY174',
  slice: { aggregate: 'LA-AUT-A9', name: 'value-object' },
  name: 'get-value-object',
  description: 'Reads a value object whole as its readers read it, by its ID or the ID of any record in it: the record asked for and its kind, the value object\'s own details and the product its ID names, its fields in order, its constraints by ID each with its test (and the test data sets it starts from), and its value type with the standard rules it meets and the packages it uses.',
  method: 'GET',
  route: '/api/value-object/get-value-object',
} as const;

export const LIST_VALUE_OBJECTS_IDENTITY = {
  id: 'LA-AUT-QRY175',
  slice: { aggregate: 'LA-AUT-A9', name: 'value-object' },
  name: 'list-value-objects',
  description: 'Lists the value objects of a product (those whose ID names it), by ID, with their titles.',
  method: 'GET',
  route: '/api/value-object/list-value-objects',
} as const;

export const NEXT_VALUE_OBJECT_ID_IDENTITY = {
  id: 'LA-AUT-QRY176',
  slice: { aggregate: 'LA-AUT-A9', name: 'value-object' },
  name: 'next-id',
  description: 'The next free ID for a value object (under its product) or a constraint (under its value object): one past the highest in use; or the one ID of a value type (under its value object) or a constraint test (under its constraint).',
  method: 'GET',
  route: '/api/value-object/next-id',
} as const;
