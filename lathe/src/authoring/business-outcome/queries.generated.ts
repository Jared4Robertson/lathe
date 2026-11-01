// Generated from data/ by `npm run generate`. Do not edit.

export const GET_BUSINESS_OUTCOME_IDENTITY = {
  id: 'LA-AUT-QRY115',
  slice: { aggregate: 'LA-AUT-A16', name: 'business-outcome' },
  name: 'get-business-outcome',
  description: 'Reads a business outcome whole, by its ID: its statement, measure and target, the tests and records that measure it, and the capabilities and journeys that serve it.',
  method: 'GET',
  route: '/api/business-outcome/get-business-outcome',
} as const;

export const LIST_BUSINESS_OUTCOMES_IDENTITY = {
  id: 'LA-AUT-QRY116',
  slice: { aggregate: 'LA-AUT-A16', name: 'business-outcome' },
  name: 'list-business-outcomes',
  description: 'Lists the business outcomes of a product, by ID, with their titles.',
  method: 'GET',
  route: '/api/business-outcome/list-business-outcomes',
} as const;

export const NEXT_BUSINESS_OUTCOME_ID_IDENTITY = {
  id: 'LA-AUT-QRY117',
  slice: { aggregate: 'LA-AUT-A16', name: 'business-outcome' },
  name: 'next-id',
  description: 'The next free ID for a business outcome of a product: one past the highest in use.',
  method: 'GET',
  route: '/api/business-outcome/next-id',
} as const;
