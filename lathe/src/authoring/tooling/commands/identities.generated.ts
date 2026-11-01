// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_TOOLING_IDENTITY = {
  id: 'LA-AUT-CMD155',
  slice: { aggregate: 'LA-AUT-A21', name: 'tooling' },
  name: 'add-tooling',
  description: 'Adds a tooling record under its domain, with the packages it uses and the standard rules it meets.',
  method: 'POST',
  route: '/api/tooling/add-tooling',
} as const;

export const CHANGE_TOOLING_IDENTITY = {
  id: 'LA-AUT-CMD156',
  slice: { aggregate: 'LA-AUT-A21', name: 'tooling' },
  name: 'change-tooling',
  description: 'Changes a tooling record\'s title, file, packages or standard rules met. Its domain stays.',
  method: 'POST',
  route: '/api/tooling/change-tooling',
} as const;

export const REMOVE_TOOLING_IDENTITY = {
  id: 'LA-AUT-CMD157',
  slice: { aggregate: 'LA-AUT-A21', name: 'tooling' },
  name: 'remove-tooling',
  description: 'Removes a tooling record whole, with the packages it names and the links it starts. Refused while anything references it.',
  method: 'POST',
  route: '/api/tooling/remove-tooling',
} as const;
