// Generated from data/ by `npm run generate`. Do not edit.

export const GET_SPECIFICATION_IDENTITY = {
  id: 'LA-AUT-QRY170',
  slice: { aggregate: 'LA-AUT-A5', name: 'specification' },
  name: 'get-specification',
  description: 'Reads a specification whole as its readers read it, by its ID or the ID of its predicate or test: the record asked for and its kind, the specification\'s own details and the domain its ID names, the aggregates it reads, its predicate with the standard rules it meets and the packages it uses, and its test with the test data sets it starts from.',
  method: 'GET',
  route: '/api/specification/get-specification',
} as const;

export const LIST_SPECIFICATIONS_IDENTITY = {
  id: 'LA-AUT-QRY171',
  slice: { aggregate: 'LA-AUT-A5', name: 'specification' },
  name: 'list-specifications',
  description: 'Lists the specifications of a domain (those whose ID names it), by ID, with their titles.',
  method: 'GET',
  route: '/api/specification/list-specifications',
} as const;

export const NEXT_SPECIFICATION_ID_IDENTITY = {
  id: 'LA-AUT-QRY172',
  slice: { aggregate: 'LA-AUT-A5', name: 'specification' },
  name: 'next-id',
  description: 'The next free ID for a specification (under its domain: one past the highest in use), or the one ID of a predicate or specification test (under its specification).',
  method: 'GET',
  route: '/api/specification/next-id',
} as const;
