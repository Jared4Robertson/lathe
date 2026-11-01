// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_BUSINESS_OUTCOME_IDENTITY = {
  id: 'LA-AUT-CMD140',
  slice: { aggregate: 'LA-AUT-A16', name: 'business-outcome' },
  name: 'add-business-outcome',
  description: 'Adds a business outcome under its product, with the tests and records that measure it.',
  method: 'POST',
  route: '/api/business-outcome/add-business-outcome',
} as const;

export const CHANGE_BUSINESS_OUTCOME_IDENTITY = {
  id: 'LA-AUT-CMD141',
  slice: { aggregate: 'LA-AUT-A16', name: 'business-outcome' },
  name: 'change-business-outcome',
  description: 'Changes a business outcome\'s title, statement, measure, target, how it is measured outside the code or notes, or what measures it (the whole list). Its product stays.',
  method: 'POST',
  route: '/api/business-outcome/change-business-outcome',
} as const;

export const REMOVE_BUSINESS_OUTCOME_IDENTITY = {
  id: 'LA-AUT-CMD142',
  slice: { aggregate: 'LA-AUT-A16', name: 'business-outcome' },
  name: 'remove-business-outcome',
  description: 'Removes a business outcome with the measured_by links it starts. Refused while a capability serves it, or anything else references it.',
  method: 'POST',
  route: '/api/business-outcome/remove-business-outcome',
} as const;
