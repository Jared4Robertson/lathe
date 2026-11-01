// Generated from data/ by `npm run generate`. Do not edit.

export const GET_PRODUCT_IDENTITY = {
  id: 'LA-AUT-QRY110',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'get-product',
  description: 'Reads a product whole, by its ID, the ID of an open question or interface in it, or the name of a kind it declares: its own details, roles, business outcomes and domains, declared kinds with their fields, relations, open questions with what they are about, and interfaces, each with the roles that use it, the patterns it follows and the use cases it offers and does not, by capability.',
  method: 'GET',
  route: '/api/product/get-product',
} as const;

export const LIST_INTERFACES_IDENTITY = {
  id: 'LA-AUT-QRY111',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'list-interfaces',
  description: 'Lists the interfaces of a product, by ID, with their titles and kinds.',
  method: 'GET',
  route: '/api/product/list-interfaces',
} as const;

export const NEXT_PRODUCT_ID_IDENTITY = {
  id: 'LA-AUT-QRY112',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'next-id',
  description: 'The next free ID for an open question (under a product or a domain) or an interface (under a product): one past the highest in use.',
  method: 'GET',
  route: '/api/product/next-id',
} as const;

export const LIST_PRODUCTS_IDENTITY = {
  id: 'LA-AUT-QRY113',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'list-products',
  description: 'Lists every product, by ID, with its title, and its icon and color when it gives them.',
  method: 'GET',
  route: '/api/product/list-products',
} as const;
