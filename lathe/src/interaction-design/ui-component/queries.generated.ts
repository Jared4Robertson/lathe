// Generated from data/ by `npm run generate`. Do not edit.

export const GET_UI_COMPONENT_IDENTITY = {
  id: 'LA-IXD-QRY204',
  slice: { aggregate: 'LA-IXD-A15', name: 'ui-component' },
  name: 'get-ui-component',
  description: 'Reads a UI component whole as its readers read it: the record asked for and its kind, the component\'s own details, and the views it renders, the view requirements it builds, the standard rules it meets and the packages it uses, each list sorted.',
  method: 'GET',
  route: '/api/ui-component/get-ui-component',
} as const;

export const LIST_UI_COMPONENTS_IDENTITY = {
  id: 'LA-IXD-QRY205',
  slice: { aggregate: 'LA-IXD-A15', name: 'ui-component' },
  name: 'list-ui-components',
  description: 'Lists the UI components of a product, by ID, with their titles.',
  method: 'GET',
  route: '/api/ui-component/list-ui-components',
} as const;

export const NEXT_UI_COMPONENT_ID_IDENTITY = {
  id: 'LA-IXD-QRY206',
  slice: { aggregate: 'LA-IXD-A15', name: 'ui-component' },
  name: 'next-id',
  description: 'The next free ID for a UI component of a product: one past the highest in use.',
  method: 'GET',
  route: '/api/ui-component/next-id',
} as const;
