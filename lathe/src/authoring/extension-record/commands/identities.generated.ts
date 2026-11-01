// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_EXTENSION_RECORD_IDENTITY = {
  id: 'LA-AUT-CMD145',
  slice: { aggregate: 'LA-AUT-A19', name: 'extension-record' },
  name: 'add-extension-record',
  description: 'Adds a record of a product\'s own kind under its parent, with its title and declared fields, the links it starts and the packages it uses.',
  method: 'POST',
  route: '/api/extension-record/add-extension-record',
} as const;

export const CHANGE_EXTENSION_RECORD_IDENTITY = {
  id: 'LA-AUT-CMD146',
  slice: { aggregate: 'LA-AUT-A19', name: 'extension-record' },
  name: 'change-extension-record',
  description: 'Changes a record of a product\'s own kind: its title or declared fields, the links it starts by relation, or the packages it uses. Its kind and parent never change.',
  method: 'POST',
  route: '/api/extension-record/change-extension-record',
} as const;

export const REMOVE_EXTENSION_RECORD_IDENTITY = {
  id: 'LA-AUT-CMD147',
  slice: { aggregate: 'LA-AUT-A19', name: 'extension-record' },
  name: 'remove-extension-record',
  description: 'Removes a record of a product\'s own kind with the links it starts and the packages it uses. Refused while anything else references it.',
  method: 'POST',
  route: '/api/extension-record/remove-extension-record',
} as const;
