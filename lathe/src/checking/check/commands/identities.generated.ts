// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_CHECK_IDENTITY = {
  id: 'LA-CHK-CMD01',
  slice: { aggregate: 'LA-CHK-A1', name: 'check' },
  name: 'add-check',
  description: 'Adds a check row: its name, the product it belongs to (none for Lathe\'s own), its place in the run order, its severity, summary, explanation and one SELECT, and the kinds it concerns. A name one of Lathe\'s checks has is refused.',
  method: 'POST',
  route: '/api/check/add-check',
} as const;

export const CHANGE_CHECK_IDENTITY = {
  id: 'LA-CHK-CMD02',
  slice: { aggregate: 'LA-CHK-A1', name: 'check' },
  name: 'change-check',
  description: 'Changes a check row\'s place in the run order, severity, summary, explanation, query or kinds. Its name and product do not change, and Lathe\'s own checks are read-only.',
  method: 'POST',
  route: '/api/check/change-check',
} as const;

export const REMOVE_CHECK_IDENTITY = {
  id: 'LA-CHK-CMD03',
  slice: { aggregate: 'LA-CHK-A1', name: 'check' },
  name: 'remove-check',
  description: 'Removes a product\'s check row, so it no longer runs; Lathe\'s own checks are read-only.',
  method: 'POST',
  route: '/api/check/remove-check',
} as const;
