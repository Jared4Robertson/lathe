// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_GUARANTEE_IDENTITY = {
  id: 'LA-MOD-CMD400',
  slice: { aggregate: 'LA-MOD-A24', name: 'guarantee' },
  name: 'add-guarantee',
  description: 'Adds a guarantee to a platform domain, with what every other domain can rely on and the building blocks that keep it.',
  method: 'POST',
  route: '/api/guarantee/add-guarantee',
} as const;

export const CHANGE_GUARANTEE_IDENTITY = {
  id: 'LA-MOD-CMD401',
  slice: { aggregate: 'LA-MOD-A24', name: 'guarantee' },
  name: 'change-guarantee',
  description: 'Changes a guarantee\'s title or statement, or the building blocks that keep it (the whole list). Its domain never changes.',
  method: 'POST',
  route: '/api/guarantee/change-guarantee',
} as const;

export const REMOVE_GUARANTEE_IDENTITY = {
  id: 'LA-MOD-CMD402',
  slice: { aggregate: 'LA-MOD-A24', name: 'guarantee' },
  name: 'remove-guarantee',
  description: 'Removes a guarantee with its guarantee tests and the links they start. Refused while anything references it or them.',
  method: 'POST',
  route: '/api/guarantee/remove-guarantee',
} as const;

export const ADD_GUARANTEE_TEST_IDENTITY = {
  id: 'LA-MOD-CMD403',
  slice: { aggregate: 'LA-MOD-A24', name: 'guarantee' },
  name: 'add-guarantee-test',
  description: 'Adds a guarantee test under its guarantee, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/guarantee/add-guarantee-test',
} as const;

export const CHANGE_GUARANTEE_TEST_IDENTITY = {
  id: 'LA-MOD-CMD404',
  slice: { aggregate: 'LA-MOD-A24', name: 'guarantee' },
  name: 'change-guarantee-test',
  description: 'Changes a guarantee test\'s way of running or the test data sets it starts from (the whole list).',
  method: 'POST',
  route: '/api/guarantee/change-guarantee-test',
} as const;

export const REMOVE_GUARANTEE_TEST_IDENTITY = {
  id: 'LA-MOD-CMD405',
  slice: { aggregate: 'LA-MOD-A24', name: 'guarantee' },
  name: 'remove-guarantee-test',
  description: 'Removes a guarantee test and the links it starts. Refused while anything references it.',
  method: 'POST',
  route: '/api/guarantee/remove-guarantee-test',
} as const;
