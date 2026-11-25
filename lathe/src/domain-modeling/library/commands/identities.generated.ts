// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_LIBRARY_IDENTITY = {
  id: 'LA-MOD-CMD409',
  slice: { aggregate: 'LA-MOD-A26', name: 'library' },
  name: 'add-library',
  description: 'Adds a library to a business domain: what the product holds for code outside the repo, with the business outcomes it serves.',
  method: 'POST',
  route: '/api/library/add-library',
} as const;

export const CHANGE_LIBRARY_IDENTITY = {
  id: 'LA-MOD-CMD410',
  slice: { aggregate: 'LA-MOD-A26', name: 'library' },
  name: 'change-library',
  description: 'Changes a library\'s title or description, or the business outcomes it serves (the whole list). Its domain never changes.',
  method: 'POST',
  route: '/api/library/change-library',
} as const;

export const REMOVE_LIBRARY_IDENTITY = {
  id: 'LA-MOD-CMD411',
  slice: { aggregate: 'LA-MOD-A26', name: 'library' },
  name: 'remove-library',
  description: 'Removes a library and the links it starts. Refused while anything references it, such as a guarantee it makes or a pattern whose fixed part it makes.',
  method: 'POST',
  route: '/api/library/remove-library',
} as const;
