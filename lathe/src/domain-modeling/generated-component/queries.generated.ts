// Generated from data/ by `npm run generate`. Do not edit.

export const GET_GENERATED_COMPONENT_IDENTITY = {
  id: 'LA-MOD-QRY231',
  slice: { aggregate: 'LA-MOD-A25', name: 'generated-component' },
  name: 'get-generated-component',
  description: 'Reads a generated component by its ID as its readers read it: its own details, the business outcomes it serves and the guarantees it makes.',
  method: 'GET',
  route: '/api/generated-component/get-generated-component',
} as const;

export const LIST_GENERATED_COMPONENTS_IDENTITY = {
  id: 'LA-MOD-QRY232',
  slice: { aggregate: 'LA-MOD-A25', name: 'generated-component' },
  name: 'list-generated-components',
  description: 'Lists the generated components of a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/generated-component/list-generated-components',
} as const;

export const NEXT_GENERATED_COMPONENT_ID_IDENTITY = {
  id: 'LA-MOD-QRY233',
  slice: { aggregate: 'LA-MOD-A25', name: 'generated-component' },
  name: 'next-id',
  description: 'The next free ID for a generated component of a domain: one past the highest in use.',
  method: 'GET',
  route: '/api/generated-component/next-id',
} as const;
