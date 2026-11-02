// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_DATA_STORE_IDENTITY = {
  id: 'LA-TEC-CMD370',
  slice: { aggregate: 'LA-TEC-A23', name: 'data-store' },
  name: 'add-data-store',
  description: 'Adds a data store under its product or one of its domains (exactly one of product_id and domain_id). What provides it, when it is a service someone else runs, is named with Name a provider.',
  method: 'POST',
  route: '/api/data-store/add-data-store',
} as const;

export const CHANGE_DATA_STORE_IDENTITY = {
  id: 'LA-TEC-CMD371',
  slice: { aggregate: 'LA-TEC-A23', name: 'data-store' },
  name: 'change-data-store',
  description: 'Changes a data store\'s title, kind or description. Its product or domain never changes: remove it and add it again under another.',
  method: 'POST',
  route: '/api/data-store/change-data-store',
} as const;

export const REMOVE_DATA_STORE_IDENTITY = {
  id: 'LA-TEC-CMD372',
  slice: { aggregate: 'LA-TEC-A23', name: 'data-store' },
  name: 'remove-data-store',
  description: 'Removes a data store whole. Refused while a repository, reader or table is stored in it, or something provides it, naming each.',
  method: 'POST',
  route: '/api/data-store/remove-data-store',
} as const;

export const MOVE_DATA_STORE_IDENTITY = {
  id: 'LA-TEC-CMD399',
  slice: { aggregate: 'LA-TEC-A23', name: 'data-store' },
  name: 'move-data-store',
  description: 'Moves a data store that sits under a domain to another domain of its product: it takes the new domain\'s ID in place of the old one\'s, and every record that names it names the new ID. Refused for a data store of the product as a whole, a domain of another product, or a new ID another record has.',
  method: 'POST',
  route: '/api/data-store/move-data-store',
} as const;
