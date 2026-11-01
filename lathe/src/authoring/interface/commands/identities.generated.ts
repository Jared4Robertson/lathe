// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_INTERFACE_IDENTITY = {
  id: 'LA-AUT-CMD132',
  slice: { aggregate: 'LA-AUT-A24', name: 'interface' },
  name: 'add-interface',
  description: 'Adds an interface of a product: a way it is used, such as an app a person works in, calls other programs make, or a command line, with the roles that use it and the use cases it offers.',
  method: 'POST',
  route: '/api/interface/add-interface',
} as const;

export const CHANGE_INTERFACE_IDENTITY = {
  id: 'LA-AUT-CMD133',
  slice: { aggregate: 'LA-AUT-A24', name: 'interface' },
  name: 'change-interface',
  description: 'Changes an interface\'s title, kind, description, whether it is public, the roles that use it or the use cases it offers (each list replaced whole).',
  method: 'POST',
  route: '/api/interface/change-interface',
} as const;

export const REMOVE_INTERFACE_IDENTITY = {
  id: 'LA-AUT-CMD134',
  slice: { aggregate: 'LA-AUT-A24', name: 'interface' },
  name: 'remove-interface',
  description: 'Removes an interface with its roles and the use cases it offers. Refused while a variant step or a view names it, or anything else references it.',
  method: 'POST',
  route: '/api/interface/remove-interface',
} as const;
