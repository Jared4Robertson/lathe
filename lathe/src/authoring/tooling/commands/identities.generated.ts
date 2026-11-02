// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_TOOLING_IDENTITY = {
  id: 'LA-AUT-CMD155',
  slice: { aggregate: 'LA-AUT-A21', name: 'tooling' },
  name: 'add-tooling',
  description: 'Adds a tooling record under its domain, with the packages it uses, the standard rules it meets and the technical records it generates.',
  method: 'POST',
  route: '/api/tooling/add-tooling',
} as const;

export const CHANGE_TOOLING_IDENTITY = {
  id: 'LA-AUT-CMD156',
  slice: { aggregate: 'LA-AUT-A21', name: 'tooling' },
  name: 'change-tooling',
  description: 'Changes a tooling record\'s title, file, packages, standard rules met or technical records generated. Its domain stays.',
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

export const MOVE_TOOLING_IDENTITY = {
  id: 'LA-AUT-CMD394',
  slice: { aggregate: 'LA-AUT-A21', name: 'tooling' },
  name: 'move-tooling',
  description: 'Moves a dev script or config file to another domain of its product: it takes the new domain\'s ID in place of the old one\'s, and every record that names it names the new ID. Refused for a domain of another product, or a new ID another record has.',
  method: 'POST',
  route: '/api/tooling/move-tooling',
} as const;
