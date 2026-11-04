// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_ENTRY_POINT_IDENTITY = {
  id: 'LA-TEC-CMD150',
  slice: { aggregate: 'LA-TEC-A20', name: 'entry-point' },
  name: 'add-entry-point',
  description: 'Adds an entry point under its domain, with the packages it uses, its helper files and the standard rules it meets.',
  method: 'POST',
  route: '/api/entry-point/add-entry-point',
} as const;

export const CHANGE_ENTRY_POINT_IDENTITY = {
  id: 'LA-TEC-CMD151',
  slice: { aggregate: 'LA-TEC-A20', name: 'entry-point' },
  name: 'change-entry-point',
  description: 'Changes an entry point\'s title, file, description, packages, helper files or standard rules met. Its domain stays.',
  method: 'POST',
  route: '/api/entry-point/change-entry-point',
} as const;

export const REMOVE_ENTRY_POINT_IDENTITY = {
  id: 'LA-TEC-CMD152',
  slice: { aggregate: 'LA-TEC-A20', name: 'entry-point' },
  name: 'remove-entry-point',
  description: 'Removes an entry point whole, with the packages and helper files it names and the links it starts. Refused while anything references it.',
  method: 'POST',
  route: '/api/entry-point/remove-entry-point',
} as const;

export const MOVE_ENTRY_POINT_IDENTITY = {
  id: 'LA-TEC-CMD398',
  slice: { aggregate: 'LA-TEC-A20', name: 'entry-point' },
  name: 'move-entry-point',
  description: 'Moves a start-up file to another domain of its product: it takes the new domain\'s ID in place of the old one\'s, and every record that names it names the new ID. Refused for a domain of another product, or a new ID another record has.',
  method: 'POST',
  route: '/api/entry-point/move-entry-point',
} as const;
