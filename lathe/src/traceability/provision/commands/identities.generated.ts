// Generated from data/ by `npm run generate`. Do not edit.

export const NAME_PROVIDER_IDENTITY = {
  id: 'LA-TRC-CMD13',
  slice: { aggregate: 'LA-TRC-A5', name: 'provision' },
  name: 'name-provider',
  description: 'Names what provides a data store, technical record or obligation from outside the product, in place of any provider it had.',
  method: 'POST',
  route: '/api/provision/name-provider',
} as const;

export const REMOVE_PROVIDER_IDENTITY = {
  id: 'LA-TRC-CMD14',
  slice: { aggregate: 'LA-TRC-A5', name: 'provision' },
  name: 'remove-provider',
  description: 'Removes a record\'s provider: it is no longer provided from outside the product.',
  method: 'POST',
  route: '/api/provision/remove-provider',
} as const;
