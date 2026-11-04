// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_VIEW_IDENTITY = {
  id: 'LA-IXD-CMD310',
  slice: { aggregate: 'LA-IXD-A12', name: 'view' },
  name: 'add-view',
  description: 'Adds a view: a place in an interface a person uses, with its address, the one interface that shows it if only one does, and the commands and queries it presents. It has no owner; its product follows from its ID.',
  method: 'POST',
  route: '/api/view/add-view',
} as const;

export const CHANGE_VIEW_IDENTITY = {
  id: 'LA-IXD-CMD311',
  slice: { aggregate: 'LA-IXD-A12', name: 'view' },
  name: 'change-view',
  description: 'Changes a view\'s title, address, interface, description or notes, or what it presents (the whole list).',
  method: 'POST',
  route: '/api/view/change-view',
} as const;

export const REMOVE_VIEW_IDENTITY = {
  id: 'LA-IXD-CMD312',
  slice: { aggregate: 'LA-IXD-A12', name: 'view' },
  name: 'remove-view',
  description: 'Removes a view whole: its view requirements and their view tests and the links they start. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/view/remove-view',
} as const;

export const ADD_VIEW_REQUIREMENT_IDENTITY = {
  id: 'LA-IXD-CMD313',
  slice: { aggregate: 'LA-IXD-A12', name: 'view' },
  name: 'add-view-requirement',
  description: 'Adds a view requirement under its view: one rule the view must follow.',
  method: 'POST',
  route: '/api/view/add-view-requirement',
} as const;

export const CHANGE_VIEW_REQUIREMENT_IDENTITY = {
  id: 'LA-IXD-CMD314',
  slice: { aggregate: 'LA-IXD-A12', name: 'view' },
  name: 'change-view-requirement',
  description: 'Changes a view requirement\'s title, statement or group. Its view does not change.',
  method: 'POST',
  route: '/api/view/change-view-requirement',
} as const;

export const REMOVE_VIEW_REQUIREMENT_IDENTITY = {
  id: 'LA-IXD-CMD315',
  slice: { aggregate: 'LA-IXD-A12', name: 'view' },
  name: 'remove-view-requirement',
  description: 'Removes a view requirement with its view tests and the links they start. Refused while anything else references them.',
  method: 'POST',
  route: '/api/view/remove-view-requirement',
} as const;

export const ADD_VIEW_TEST_IDENTITY = {
  id: 'LA-IXD-CMD316',
  slice: { aggregate: 'LA-IXD-A12', name: 'view' },
  name: 'add-view-test',
  description: 'Adds a view test under its view requirement, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/view/add-view-test',
} as const;

export const CHANGE_VIEW_TEST_IDENTITY = {
  id: 'LA-IXD-CMD317',
  slice: { aggregate: 'LA-IXD-A12', name: 'view' },
  name: 'change-view-test',
  description: 'Changes a view test\'s way of running or the test data sets it starts from (the whole list). Its requirement does not change.',
  method: 'POST',
  route: '/api/view/change-view-test',
} as const;

export const REMOVE_VIEW_TEST_IDENTITY = {
  id: 'LA-IXD-CMD318',
  slice: { aggregate: 'LA-IXD-A12', name: 'view' },
  name: 'remove-view-test',
  description: 'Removes a view test with the links it starts. Refused while anything else references them.',
  method: 'POST',
  route: '/api/view/remove-view-test',
} as const;
